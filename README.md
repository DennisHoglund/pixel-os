# Pixel-OS

En liten fejk-terminal (grönt på svart) som PWA. Listar mina GitHub-projekt med äkta data.

## Kommandon

| Kommando | Gör |
|---|---|
| `ls` | lista projekt |
| `ls -l` | status (`[wip]` = pushat senaste veckan), senaste push, språk |
| `cat <projekt>` | beskrivning, datum, app-länk, senaste commit |
| `log <projekt> [n]` | senaste commits |
| `open <projekt>` | öppna appen (GitHub Pages) eller repot |
| `git clone <projekt>` | visa klon-kommandot |
| `neofetch`, `whoami`, `date`, `clear`, `help` | |

Tab kompletterar, ↑↓ bläddrar i historiken. På mobilen finns snabbknappar under terminalen.

## Teknik

- Ren HTML/JS, inget byggsteg.
- Data från GitHubs publika API (`/users/DennisHoglund/repos`), ingen nyckel. Max 60 anrop/timme, så svaren cachas 5 min i localStorage – och visas offline.
- Service worker cachar själva appen.

## Driftsätt

Settings → Pages → Deploy from branch → `main` / root.
