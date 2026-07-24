# SBSMonitor Agent — Rust / Windows legado

Este é o fork em Rust do agente Bun em `../agent`. Ele preserva o mesmo protocolo
de registro e métricas, mas foi projetado para gerar um executável x86 compatível
com Windows XP SP3, Vista, 7, 8 e versões posteriores usando Thunk, VC-LTL5 e
YY-Thunks. O agente Bun original não é alterado e continua sendo indicado para
Windows 10/11 quando Bun for apropriado.

## Configuração

Copie `.env.example` para `.env` no mesmo diretório de `sbsmonitor-agent-rust.exe`.
`SERVER_URL` deve ser uma URL HTTP ou HTTPS. `CA_CERT_PATH` é opcional e aponta para um
arquivo PEM com uma ou mais CAs internas; essas CAs são acrescentadas às raízes
WebPKI incorporadas. O agente nunca usa Schannel nem desativa a validação TLS.

Os logs são gravados como `agent-rust.log` ao lado do executável. Nunca habilite
logs de depuração de transporte em produção, pois headers de autenticação podem
ser sensíveis.

## Build x86 com Thunk

Faça o build em um Windows com Visual Studio C++ Build Tools (x86), Rust MSVC,
`curl` e `7z` disponíveis no `PATH`:

```powershell
rustup target add i686-pc-windows-msvc
cargo build --release --target i686-pc-windows-msvc
```

Antes do build, instale VC-LTL5 (>= 5.1.1-Beta2) e YY-Thunks
(>= 1.1.1-Beta1), e defina `VC_LTL` e `YY_THUNKS` para seus diretórios. Como
alternativa, o `build.rs` do Thunk pode obtê-los quando `curl` e `7z` estão no
`PATH`. A integração é configurada por `thunk-rs` com as features `xp` e
`vc_ltl_only`.

O arquivo final é `target\i686-pc-windows-msvc\release\sbsmonitor-agent-rust.exe`.
Teste-o primeiro com `--console` e, obrigatoriamente, em VMs x86 de XP SP3,
Vista, 7, 8 e 10 antes da distribuição.

## Serviço do Windows

Execute como administrador, substituindo o caminho real:

```powershell
sc.exe create SBSMonitorAgentRust binPath= "C:\Program Files\SBSMonitor\sbsmonitor-agent-rust.exe" start= auto
sc.exe start SBSMonitorAgentRust
```

Para parar e remover:

```powershell
sc.exe stop SBSMonitorAgentRust
sc.exe delete SBSMonitorAgentRust
```

O agente executa um ciclo imediatamente, registra novamente após falhas de rede
ou `401`, e nunca encerra o serviço por erro de coleta ou envio. Os scripts Bun e
de CI na raiz não são alterados; uma futura pipeline deve adicionar este crate
explicitamente.

## Limitações Conhecidas e Arquitetura

- **Resolução de DNS em Thread Auxiliar**: A biblioteca padrão do Rust (`std::net::ToSocketAddrs`) realiza chamadas síncronas ao resolvedor de nomes do sistema operacional sem suporte a timeout configurável nativo. Para preservar a compatibilidade com o Windows XP e evitar a inclusão de um runtime assíncrono pesado (como `tokio`), a resolução DNS é executada em uma thread dedicada usando `mpsc::Receiver::recv_timeout`. Se o DNS estiver inalcançável, a thread principal do agente aborta a requisição e retorna o erro `AgentError::DnsTimeout` no tempo limite configurado (`REQUEST_TIMEOUT`); contudo, a thread auxiliar permanecerá temporariamente em background até que o resolvedor do próprio SO encerre a chamada bloqueante.
- **Fallback de Logs em Serviços Restritos**: Quando o serviço executa sob contas de serviço restritas do Windows sem permissão de escrita na pasta de instalação, a criação do log principal (`agent-rust.log`) falha e o agente redireciona automaticamente a escrita para `%ProgramData%\SBSMonitor\agent-rust.log`.

