# blip0

Zero-config blockchain monitoring CLI built on OpenZeppelin Monitor.

## Installation

### npm (global)

```bash
npm install -g blip0
```

### npx (no install)

```bash
npx blip0 <command>
```

### bun

```bash
bun add -g blip0
```

## Usage

### Monitor whale transfers

```bash
blip0 whale-alert
```

Options:

- `-r, --reconfigure` - Reconfigure settings
- `-n, --network <network>` - Network to monitor (stellar_mainnet, ethereum_mainnet)
- `-t, --threshold <amount>` - Minimum transfer amount to alert
- `-c, --contract <address>` - Contract address to monitor

### List running monitors

```bash
blip0 list
```

### Stop a monitor

```bash
blip0 stop <session-id>
```

## Development

### Prerequisites

- [Bun](https://bun.sh) v1.0+

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/blip0.git
cd blip0/blip0-cli

# Install dependencies
bun install

# Run in development mode
bun run dev

# Build
bun run build

# Run tests
bun test
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on:

- Commit message conventions
- Pull request process
- Release workflow

## License

MIT
