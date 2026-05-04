import { useState } from "react";
import { Search, ShieldAlert, Terminal, Copy, Play } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  color: string;
  bgColor: string;
  tools: Tool[];
};

const CATEGORIES: Category[] = [
  {
    id: "osint",
    name: "OSINT / Reconocimiento",
    color: "text-cyan-400",
    bgColor: "bg-cyan-950/30",
    tools: [
      {
        name: "Nmap",
        description: "Network Mapper for discovery and security auditing",
        commands: [
          { desc: "Basic scan", cmd: "nmap <target>", demoCmd: "nmap localhost" },
          { desc: "OS detection", cmd: "nmap -O <target>", demoCmd: "nmap -O localhost" }
        ]
      },
      {
        name: "theHarvester",
        description: "E-mail, subdomain and people names harvester",
        commands: [
          { desc: "Search Google", cmd: "theHarvester -d <domain> -l 500 -b google", demoCmd: "echo 'Demo: theHarvester -d example.com -b google'" }
        ]
      },
      {
        name: "Sherlock",
        description: "Hunt down social media accounts by username",
        commands: [
          { desc: "Search username", cmd: "python3 sherlock.py <username>", demoCmd: "echo 'Demo: sherlock johndoe'" }
        ]
      }
    ]
  },
  {
    id: "escaneo",
    name: "Escaneo / Enumeración",
    color: "text-blue-400",
    bgColor: "bg-blue-950/30",
    tools: [
      {
        name: "Masscan",
        description: "TCP port scanner, spews SYN packets asynchronously",
        commands: [
          { desc: "Scan subnet", cmd: "masscan -p80,8000-8100 10.0.0.0/8", demoCmd: "echo 'Demo: masscan localhost'" }
        ]
      },
      {
        name: "Netcat (nc)",
        description: "Utility for reading from and writing to network connections",
        commands: [
          { desc: "Listen on port", cmd: "nc -lvnp <port>", demoCmd: "nc -lvnp 8080" },
          { desc: "Connect to target", cmd: "nc <target> <port>", demoCmd: "echo 'Demo: nc localhost 8080'" }
        ]
      }
    ]
  },
  {
    id: "vuln",
    name: "Análisis de Vulnerabilidades",
    color: "text-yellow-400",
    bgColor: "bg-yellow-950/30",
    tools: [
      {
        name: "Nikto",
        description: "Web server scanner",
        commands: [
          { desc: "Basic scan", cmd: "nikto -h <target>", demoCmd: "echo 'Demo: nikto -h http://localhost'" }
        ]
      }
    ]
  },
  {
    id: "explotacion",
    name: "Explotación",
    color: "text-red-400",
    bgColor: "bg-red-950/30",
    tools: [
      {
        name: "Metasploit",
        description: "Penetration testing framework",
        commands: [
          { desc: "Start console", cmd: "msfconsole", demoCmd: "echo 'Demo: Starting msfconsole...'" },
          { desc: "Search exploit", cmd: "search <name>", demoCmd: "echo 'Demo: search eternalblue'" }
        ]
      }
    ]
  },
  {
    id: "post",
    name: "Post-Explotación",
    color: "text-orange-400",
    bgColor: "bg-orange-950/30",
    tools: [
      {
        name: "NetExec (nxc)",
        description: "Network service exploitation tool",
        commands: [
          { desc: "Check SMB", cmd: "nxc smb <target> -u <user> -p <pass>", demoCmd: "echo 'Demo: nxc smb localhost'" }
        ]
      }
    ]
  },
  {
    id: "wifi",
    name: "Redes / WiFi",
    color: "text-purple-400",
    bgColor: "bg-purple-950/30",
    tools: [
      {
        name: "Aircrack-ng",
        description: "802.11 WEP and WPA-PSK keys cracking program",
        commands: [
          { desc: "Start monitor mode", cmd: "airmon-ng start <interface>", demoCmd: "echo 'Demo: airmon-ng start wlan0'" },
          { desc: "Capture packets", cmd: "airodump-ng <interface>", demoCmd: "echo 'Demo: airodump-ng wlan0'" }
        ]
      }
    ]
  }
];

export default function Tools() {
  const [search, setSearch] = useState("");
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
    toast({ title: "Command loaded", description: "Demo command loaded in workspace ready to run." });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      <div className="border-b border-border bg-card p-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono text-primary flex items-center gap-2">
            <ShieldAlert className="h-6 w-6" /> Cybersecurity Tools
          </h1>
          <p className="text-muted-foreground text-sm">Reference guide and cheat sheet</p>
        </div>
        
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search tools or commands..." 
            className="pl-10 bg-background border-border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1 p-4 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {filteredCategories.map(cat => (
            <div key={cat.id} className="flex flex-col gap-4">
              <div className={`px-4 py-2 rounded-t-lg border-b border-border ${cat.bgColor}`}>
                <h2 className={`font-bold font-mono ${cat.color} tracking-tight uppercase text-sm`}>
                  {cat.name}
                </h2>
              </div>
              
              <div className="flex flex-col gap-4">
                {cat.tools.map((tool, idx) => (
                  <div key={idx} className="bg-card border border-border rounded-lg overflow-hidden shadow-sm hover:border-primary/30 transition-colors">
                    <div className="p-3 border-b border-border/50 bg-black/20">
                      <h3 className="font-semibold text-foreground flex items-center gap-2">
                        <Terminal className="h-4 w-4 text-muted-foreground" />
                        {tool.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">{tool.description}</p>
                    </div>
                    
                    <div className="p-0 flex flex-col divide-y divide-border/30">
                      {tool.commands.map((cmd, i) => (
                        <div key={i} className="p-3 bg-black">
                          <div className="text-xs text-muted-foreground mb-1">{cmd.desc}</div>
                          <div className="flex items-center justify-between gap-2 group">
                            <code className="text-sm font-mono text-green-400 break-all select-all">
                              {cmd.cmd}
                            </code>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => copyToClipboard(cmd.cmd)}
                                title="Copy command"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              {cmd.demoCmd && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/20"
                                  onClick={() => runDemoCommand(cmd.demoCmd!)}
                                  title="Run safe demo in workspace"
                                >
                                  <Play className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          {filteredCategories.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              No tools or commands found matching "{search}"
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}