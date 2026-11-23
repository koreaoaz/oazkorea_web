using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.ServiceProcess;
using System.Text.RegularExpressions;
using System.Threading;

// Keep the child in a kill-on-close job even if SCM has to terminate the host.
internal static class ProcessGroup
{
    [StructLayout(LayoutKind.Sequential)]
    struct Limits {
        public long processTime, jobTime;
        public uint flags;
        public UIntPtr minWorkingSet, maxWorkingSet;
        public uint maxProcesses;
        public UIntPtr affinity;
        public uint priority, scheduling;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct Extended {
        public Limits limits;
        public ulong reads, writes, other, bytesRead, bytesWritten, otherBytes;
        public UIntPtr processMemory, jobMemory, peakProcess, peakJob;
    }
    [DllImport("kernel32", SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int info, ref Extended limits, uint size);
    [DllImport("kernel32", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    public static void Initialize() {
        IntPtr job = CreateJobObject(IntPtr.Zero, null);
        Extended rules = new Extended();
        rules.limits.flags = 0x2000;
        if (job == IntPtr.Zero || !SetInformationJobObject(job, 9, ref rules, (uint)Marshal.SizeOf(rules))
            || !AssignProcessToJobObject(job, Process.GetCurrentProcess().Handle))
            throw new Win32Exception();
    }
}

internal sealed class NoticeService : ServiceBase
{
    readonly ManualResetEvent stopping = new ManualResetEvent(false);
    Thread monitor;
    readonly string root = AppDomain.CurrentDomain.BaseDirectory;

    NoticeService() { ServiceName = "OAZNoticeEnglish"; CanShutdown = true; AutoLog = false; }
    void Supervise(string qa) {
        while (!stopping.WaitOne(0)) {
            var info = new ProcessStartInfo(Path.Combine(root, "runtime", "python.exe"),
                "-I -B -u \"" + Path.Combine(root, "scripts", "host_worker.py") + "\""
                + (qa == null ? "" : " --qa-db " + qa));
            info.WorkingDirectory = Path.Combine(root, "state");
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            using (Process child = Process.Start(info)) {
                while (!child.WaitForExit(500)) {
                    if (stopping.WaitOne(0)) {
                        try { child.Kill(); } catch (InvalidOperationException) {}
                        child.WaitForExit();
                        return;
                    }
                }
            }
            stopping.WaitOne(15000);
        }
    }
    protected override void OnStart(string[] args) {
        monitor = new Thread(delegate() { Supervise(null); });
        monitor.Start();
    }
    protected override void OnStop() {
        stopping.Set();
        if (monitor != null) monitor.Join(10000);
    }
    protected override void OnShutdown() { OnStop(); }
    public static int Main(string[] args) {
        ProcessGroup.Initialize();
        var host = new NoticeService();
        if (args.Length == 2 && args[0] == "--qa" && Regex.IsMatch(args[1], @"\Aoaz_notice_qa_[0-9a-f]{32}\z")) {
            host.Supervise(args[1]);
        } else if (args.Length == 0) {
            ServiceBase.Run(host);
        } else return 2;
        return 0;
    }
}
