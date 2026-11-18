# Nected — Etapas da plataforma

Simulador visual de redes para treinar a rotina de TI de loja: roteador, switch, load balance, CFTV, VoIP, impressora térmica e crimpagem.

## Etapa 1 — Fundação ✅
- Projeto em **ES modules sem build** (abre em qualquer servidor estático: GitHub Pages, Firebase Hosting).
- Separação clara: `js/core` (motor, sem DOM) · `js/sim` (fila de simulação e serviços) · `js/ui` (interface).
- Estado do laboratório, **vários laboratórios** salvos no navegador, migração do protótipo v1.
- Desfazer / refazer.

## Etapa 2 — Motor de rede + testes ✅
- Endereçamento IPv4, máscara, gateway, DNS, APIPA (169.254) e conflito de IP.
- DHCP com pool e concessões estáveis; mais de um servidor DHCP gera aviso.
- Switch com VLAN por porta (redes isoladas).
- Roteamento hop a hop, NAT, **rotas estáticas**, roteador atrás de roteador.
- Load Balance: balanceamento por peso, failover, health check.
- Cabos: patch cord, crimpados (direto / crossover / split pair / defeituoso), coaxial, RJ11, HDMI.
- Testes automatizados com `node --test` (sem dependências).

## Etapa 3 — Editor visual ✅
- Canvas com arrastar e soltar, pan e zoom (mouse, roda e pinça no celular).
- Dock de aparelhos por categoria, ferramenta de cabo e de exclusão.
- Conexões que pulsam; vermelho = sem link, laranja = instável.

## Etapa 4 — Janelas de configuração e serviços ✅
- Janelas estilo Windows (mover, minimizar, maximizar, abas).
- Terminal: `ipconfig`, `ping`, `tracert`, `nslookup`, `arp -a`, `print`.
- CFTV: DVR com canais analógicos e IP, TV de vigilância com mosaico ao vivo.
- VoIP: PABX, ramal IP, ATA + telefone analógico, chamadas SIP/RTP.
- Impressora térmica (RAW 9100 + autoteste), bancada de crimpagem.

## Etapa 5 — Simulação, missões, PWA e deploy ✅
- Modo tempo real × simulação passo a passo, lista e filtro de eventos.
- Missões com defeitos plantados no cenário exemplo.
- Exportar / importar JSON.
- PWA instalável e offline.
- GitHub Actions: testes + publicação no GitHub Pages.

## Próximas ideias
- Wi-Fi (SSID, senha, canal) e roteador em modo AP.
- Firewall / redirecionamento de portas (acesso remoto ao DVR).
- PoE no switch alimentando câmeras e ramais.
- Contas e laboratórios na nuvem (Firebase) para compartilhar com a equipe.
- Modo prova: desafios com nota e tempo.
