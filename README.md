# Nected — Simulador de Redes

Laboratório visual para treinar a rotina de TI de loja: **roteador, switch, load balance, CFTV (DVR, câmeras, TV), VoIP (PABX, ramal, ATA), impressora térmica e crimpagem de cabo**.

Arraste os aparelhos para a área de trabalho, ligue os cabos, toque num aparelho para abrir a janela de configuração e teste tudo pelo terminal — como no Packet Tracer, mas focado no dia a dia de loja.

## Recursos
- **Editor**: arrastar e soltar, pan/zoom (mouse e pinça), cabos que pulsam (vermelho = sem link, laranja = instável), desfazer/refazer.
- **Janelas estilo Windows** com abas por aparelho: WAN, LAN/DHCP, rotas estáticas, VLAN por porta, canais do DVR, conta SIP…
- **Motor de rede**: IP/máscara/gateway/DNS, DHCP com pool, APIPA, conflito de IP, VLAN, roteamento, NAT, rotas estáticas, roteador atrás de roteador, load balance (peso, failover, health check).
- **Terminal**: `ipconfig`, `ipconfig /renew`, `ping`, `tracert`, `nslookup`, `arp -a`, `print <ip>` — com diagnóstico do motivo de cada falha.
- **CFTV**: câmeras analógicas (BNC) e IP (RTSP com usuário/senha), mosaico ao vivo na TV via HDMI.
- **VoIP**: registro SIP no PABX, chamadas ramal ↔ telefone analógico via ATA.
- **Crimpagem**: monte as 8 vias, teste (direto, crossover, split pair, defeituoso) e use o cabo na rede.
- **Simulação passo a passo**, lista e filtro de eventos (ARP, DHCP, DNS, ICMP, SIP, RTP, RTSP, RAW).
- **Missões** com defeitos plantados no cenário exemplo.
- **Vários laboratórios** salvos no navegador, exportar/importar JSON, **PWA** instalável e offline.

## Rodar localmente
Não há dependências nem build.

```bash
npm start      # http://localhost:5173
npm test       # testes do motor (node:test)
```

> Abrir o `index.html` direto pelo arquivo não funciona (ES modules exigem http). Use `npm start` ou qualquer servidor estático.

## Publicar
- **GitHub Pages**: o workflow `.github/workflows/pages.yml` roda os testes e publica a cada push na `main`. Ative em *Settings → Pages → Source: GitHub Actions*.
- **Firebase Hosting**: `firebase init hosting` apontando a pasta pública para a raiz do projeto (ou copie `index.html`, `manifest.webmanifest`, `sw.js`, `css/`, `js/`, `icons/`).

Ao publicar uma versão nova, troque `VERSION` em `sw.js` para os aparelhos baixarem a atualização.

## Estrutura
```
index.html            layout da aplicação
css/app.css           tema escuro
js/core/              motor sem DOM (testável no Node)
  ip.js               utilitários IPv4
  catalog.js          aparelhos, portas e configuração padrão
  store.js            estado do laboratório + desfazer/refazer
  network.js          segmentos/VLAN, DHCP, roteamento, NAT, LB, SIP, CFTV
  cable.js            padrões T568A/B e avaliação da crimpagem
  scenario.js         cenário exemplo
  persist.js          laboratórios no localStorage
  bus.js              ganchos entre motor e interface
js/sim/               fila de simulação, serviços (ping, DHCP, DNS, SIP, RAW) e missões
js/ui/                canvas, janelas, abas dos aparelhos, painel, crimpagem, laboratórios
tests/                testes do motor
docs/ROADMAP.md       etapas e próximas ideias
```

Veja as etapas do projeto em [docs/ROADMAP.md](docs/ROADMAP.md).
