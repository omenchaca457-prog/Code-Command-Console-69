import { useState } from "react";
import { Search, Terminal, Copy, Play, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation } from "wouter";
import { useAppContext } from "@/lib/app-context";
import { useToast } from "@/hooks/use-toast";

type Tool = {
  name: string;
  description: string;
  commands: { desc: string; cmd: string; demoCmd?: string }[];
};

type Category = {
  id: string;
  name: string;
  tag: string;
  accentColor: string;
  tools: Tool[];
};

const CATEGORIES: Category[] = [
  {
    id: "osint",
    name: "OSINT / Reconocimiento",
    tag: "RECON",
    accentColor: "#00ffff",
    tools: [
      {
        name: "Nmap",
        description: "Network Mapper — discovery & security auditing",
        commands: [
          { desc: "Basic scan", cmd: "nmap <target>", demoCmd: "nmap localhost" },
          { desc: "OS detection + version", cmd: "nmap -A <target>", demoCmd: "nmap -A localhost" },
          { desc: "Stealth SYN scan", cmd: "nmap -sS -T2 <target>", demoCmd: "nmap -sS localhost" }
        ]
      },
      {
        name: "theHarvester",
        description: "Email, subdomain & people names harvester",
        commands: [
          { desc: "Google harvesting", cmd: "theHarvester -d <domain> -l 500 -b google", demoCmd: "echo 'theHarvester -d example.com -b google'" }
        ]
      },
      {
        name: "Sherlock",
        description: "Hunt down social media accounts by username",
        commands: [
          { desc: "Username search", cmd: "python3 sherlock.py <username>", demoCmd: "echo 'sherlock johndoe'" }
        ]
      }
    ]
  },
  {
    id: "escaneo",
    name: "Escaneo / Enumeración",
    tag: "SCAN",
    accentColor: "#00ff41",
    tools: [
      {
        name: "Masscan",
        description: "Async TCP port scanner — high speed",
        commands: [
          { desc: "Scan full subnet", cmd: "masscan -p80,8000-8100 10.0.0.0/8", demoCmd: "echo 'masscan -p80 192.168.1.0/24'" },
          { desc: "Scan all ports", cmd: "masscan -p0-65535 <target> --rate=1000", demoCmd: "echo 'masscan -p0-65535 target'" }
        ]
      },
      {
        name: "Netcat (nc)",
        description: "TCP/UDP network utility — the swiss army knife",
        commands: [
          { desc: "Listen on port", cmd: "nc -lvnp <port>", demoCmd: "nc -lvnp 8080" },
          { desc: "Connect to host", cmd: "nc <target> <port>", demoCmd: "echo 'nc localhost 80'" },
          { desc: "Port scan", cmd: "nc -zv <target> 20-100", demoCmd: "nc -zv localhost 80-90" }
        ]
      }
    ]
  },
  {
    id: "vuln",
    name: "Análisis de Vulnerabilidades",
    tag: "VULN",
    accentColor: "#ffcc00",
    tools: [
      {
        name: "Nikto",
        description: "Web server scanner — finds dangerous files & misconfigs",
        commands: [
          { desc: "Basic web scan", cmd: "nikto -h <target>", demoCmd: "echo 'nikto -h http://localhost'" },
          { desc: "Full SSL scan", cmd: "nikto -h <target> -ssl", demoCmd: "echo 'nikto -h https://target -ssl'" }
        ]
      }
    ]
  },
  {
    id: "explotacion",
    name: "Explotación",
    tag: "EXPLOIT",
    accentColor: "#ff003c",
    tools: [
      {
        name: "Metasploit",
        description: "Advanced penetration testing framework",
        commands: [
          { desc: "Start console", cmd: "msfconsole", demoCmd: "echo '[+] Starting Metasploit...'" },
          { desc: "Search exploit", cmd: "search <name>", demoCmd: "echo 'search eternalblue'" },
          { desc: "Set payload", cmd: "set PAYLOAD windows/meterpreter/reverse_tcp", demoCmd: "echo 'set PAYLOAD meterpreter'" }
        ]
      }
    ]
  },
  {
    id: "post",
    name: "Post-Explotación",
    tag: "POST-EX",
    accentColor: "#ff7700",
    tools: [
      {
        name: "NetExec (nxc)",
        description: "Network service exploitation & lateral movement",
        commands: [
          { desc: "Check SMB auth", cmd: "nxc smb <target> -u <user> -p <pass>", demoCmd: "echo 'nxc smb target -u user -p pass'" },
          { desc: "Dump SAM", cmd: "nxc smb <target> --sam", demoCmd: "echo 'nxc smb target --sam'" }
        ]
      }
    ]
  },
  {
    id: "wifi",
    name: "Redes / WiFi",
    tag: "WIRELESS",
    accentColor: "#cc44ff",
    tools: [
      {
        name: "Aircrack-ng",
        description: "802.11 WEP/WPA-PSK cracking suite",
        commands: [
          { desc: "Enable monitor mode", cmd: "airmon-ng start <iface>", demoCmd: "echo 'airmon-ng start wlan0'" },
          { desc: "Capture handshakes", cmd: "airodump-ng <iface>", demoCmd: "echo 'airodump-ng wlan0mon'" },
          { desc: "Crack capture", cmd: "aircrack-ng -w wordlist.txt capture.cap", demoCmd: "echo 'aircrack-ng -w rockyou.txt cap'" }
        ]
      }
    ]
  }
];

export default function Tools() {
  const [search, setSearch] = useState("");
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { setCurrentCode, setCurrentLanguage } = useAppContext();
  const { toast } = useToast();

  const filteredCategories = CATEGORIES.map(cat => ({
    ...cat,
    tools: cat.tools.filter(tool =>
      tool.name.toLowerCase().includes(search.toLowerCase()) ||
      tool.description.toLowerCase().includes(search.toLowerCase()) ||
      tool.commands.some(c => c.cmd.toLowerCase().includes(search.toLowerCase()))
    )
  })).filter(cat => cat.tools.length > 0);

  const runDemoCommand = (cmd: string) => {
    setCurrentCode(cmd);
    setCurrentLanguage("bash");
    setLocation("/");
    toast({ title: "// LOADED", description: "Command ready in workspace." });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "// COPIED" });
  };

  return (
    <div className="flex flex-col h-full bg-[#070707]">
      {/* Header */}
      <div className="border-b border-[#ff003c]/15 bg-[#060606] px-6 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-xs font-mono font-bold tracking-[0.25em] uppercase text-[#ff003c]" style={{ textShadow: "0 0 10px #ff003c60" }}>
            // CYBER ARSENAL
          </h1>
          <p className="text-[10px] font-mono text-[#333] tracking-widest uppercase mt-0.5">Security tools reference — use responsibly</p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-[#333]" />
          <input
            placeholder="SEARCH TOOLS..."
            className="w-full bg-[#040404] border border-[#ff003c]/20 pl-8 pr-3 py-2 font-mono text-xs text-[#888] placeholder:text-[#2a2a2a] placeholder:tracking-widest focus:outline-none focus:border-[#ff003c]/50 tracking-wider uppercase"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1 p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
          {filteredCategories.map(cat => (
            <div key={cat.id} className="flex flex-col gap-3">
              {/* Category header */}
              <div className="flex items-center gap-2 px-3 py-2 border border-l-2 bg-[#060606]"
                style={{ borderColor: cat.accentColor + "25", borderLeftColor: cat.accentColor }}>
                <span className="text-[9px] font-mono font-bold tracking-[0.3em] uppercase"
                  style={{ color: cat.accentColor, textShadow: `0 0 6px ${cat.accentColor}60` }}>
                  [{cat.tag}]
                </span>
                <span className="text-[10px] font-mono text-[#555] tracking-wider">{cat.name}</span>
              </div>

              {/* Tools */}
              <div className="flex flex-col gap-2">
                {cat.tools.map((tool, idx) => {
                  const toolKey = `${cat.id}-${idx}`;
                  const isExpanded = expandedTool === toolKey;
                  return (
                    <div
                      key={idx}
                      className="border border-[#1a1a1a] bg-[#060606] overflow-hidden transition-all hover:border-[#2a2a2a]"
                      style={{ borderLeftColor: isExpanded ? cat.accentColor : undefined, borderLeftWidth: isExpanded ? '2px' : undefined }}
                    >
                      <button
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[#0a0a0a] transition-colors"
                        onClick={() => setExpandedTool(isExpanded ? null : toolKey)}
                      >
                        <div className="flex items-center gap-2">
                          <Terminal className="h-3 w-3" style={{ color: cat.accentColor + "80" }} />
                          <div>
                            <div className="text-xs font-mono font-bold text-[#bbb] uppercase tracking-wider">{tool.name}</div>
                            <div className="text-[10px] font-mono text-[#3a3a3a] mt-0.5 normal-case tracking-normal">{tool.description}</div>
                          </div>
                        </div>
                        <ChevronRight
                          className={`h-3 w-3 text-[#333] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      </button>

                      {isExpanded && (
                        <div className="border-t border-[#111]">
                          {tool.commands.map((cmd, i) => (
                            <div
                              key={i}
                              className="px-3 py-2.5 bg-black/40 border-b border-[#0f0f0f] last:border-b-0 group"
                            >
                              <div className="text-[9px] font-mono text-[#333] uppercase tracking-[0.2em] mb-1.5">{cmd.desc}</div>
                              <div className="flex items-center justify-between gap-2">
                                <code className="text-xs font-mono text-[#00ff41] flex-1 select-all break-all leading-relaxed"
                                  style={{ textShadow: "0 0 4px #00ff4120" }}>
                                  $ {cmd.cmd}
                                </code>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                  <button
                                    onClick={() => copyToClipboard(cmd.cmd)}
                                    className="p-1 text-[#333] hover:text-[#888] transition-colors"
                                    title="Copy"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                  {cmd.demoCmd && (
                                    <button
                                      onClick={() => runDemoCommand(cmd.demoCmd!)}
                                      className="p-1 transition-colors"
                                      style={{ color: cat.accentColor + "80" }}
                                      title="Run in workspace"
                                    >
                                      <Play className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredCategories.length === 0 && (
            <div className="col-span-full py-16 text-center font-mono text-xs text-[#222] tracking-widest uppercase">
              — NO RESULTS FOR "{search}" —
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
