export function registerCaddyLanguage(monaco) {
  if (monaco.languages.getLanguages().some((l) => l.id === 'caddyfile')) return

  monaco.languages.register({ id: 'caddyfile' })

  monaco.languages.setMonarchTokensProvider('caddyfile', {
    defaultToken: '',
    tokenPostfix: '.caddyfile',

    keywords: [
      // Top-level directives
      'root', 'file_server', 'reverse_proxy', 'tls', 'encode', 'log',
      'header', 'redir', 'rewrite', 'respond', 'php_fastcgi', 'try_files',
      'uri', 'handle', 'handle_path', 'route', 'import', 'bind',
      'basicauth', 'forward_auth', 'templates', 'push', 'acme_server',
      'request_header', 'response_header', 'abort', 'error', 'vars',
      'map', 'tracing', 'metrics', 'handle_errors',
      // Matcher keywords
      'not', 'method', 'path', 'path_regexp', 'host', 'expression',
      'remote_ip', 'query', 'header_regexp', 'protocol', 'file',
      // Sub-directives
      'to', 'from', 'output', 'format', 'level', 'roll_size', 'roll_keep',
      'header_up', 'header_down', 'lb_policy', 'health_uri', 'health_port',
      'health_interval', 'health_timeout', 'flush_interval', 'transport',
      'dial_timeout', 'keepalive', 'tls_insecure_skip_verify',
      'precompressed', 'index', 'hide', 'browse', 'pass_thru',
      // Global options block
      'email', 'http_port', 'https_port', 'local_certs', 'debug',
      'auto_https', 'order', 'servers', 'grace_period', 'shutdown_delay',
      'on_demand_tls', 'ocsp_stapling', 'key_type', 'cert_issuer',
      // Status codes / encode types
      'gzip', 'zstd', 'status',
    ],

    tokenizer: {
      root: [
        // Comments
        [/#.*$/, 'comment'],

        // Strings
        [/"([^"\\]|\\.)*"/, 'string'],
        [/'([^'\\]|\\.)*'/, 'string'],
        [/`[^`]*`/, 'string'],

        // Caddy placeholders {http.request.host} — must come before bracket rule
        [/\{[a-zA-Z_$][a-zA-Z0-9_.$]*\}/, 'variable.predefined'],

        // Block braces
        [/[{}]/, '@brackets'],

        // Named matchers @name
        [/@[a-zA-Z_][a-zA-Z0-9_]*/, 'tag'],

        // Port shorthand :80 :443
        [/:\d+/, 'number'],

        // Plain numbers
        [/\b\d+\b/, 'number'],

        // Keywords and identifiers
        [/[a-zA-Z_*][a-zA-Z0-9_\-.]*/, {
          cases: {
            '@keywords': 'keyword',
            '@default': 'identifier',
          },
        }],

        // Whitespace
        [/\s+/, 'white'],
      ],
    },
  })

  monaco.languages.setLanguageConfiguration('caddyfile', {
    comments: { lineComment: '#' },
    brackets: [['{', '}']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    indentationRules: {
      increaseIndentPattern: /^[^#]*\{[^}]*$/,
      decreaseIndentPattern: /^\s*\}/,
    },
    folding: {
      markers: {
        start: /\{/,
        end: /^\s*\}/,
      },
    },
  })
}
