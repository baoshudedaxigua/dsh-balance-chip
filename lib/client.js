// dsh-balance-chip - browser half (client plugin bundle).
//
// Loaded by dsh-client-modules (window.__ModuleLoader__.load) and activated as a
// cordis entry by the web shell. It appends the DeepSeek topped-up balance as a
// small chip right after the nickname inside the sidebar account launcher
// (bottom-left), reusing the official account Remote namespace, so no token is
// stored and no extra HTTP surface is introduced.
window.__ModuleLoader__.load({
  id: 'dsh-balance-chip',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    var PLUGIN_ID = 'dsh-balance-chip'
    var STYLE_ID = 'dsh-balance-chip/style.css'
    var REFRESH_MS = 60 * 1000
    var FALLBACK_VERSION = '0.2.1-rc.5'

    // The account Remote methods carry a client identity; the version only
    // labels the request, while locale and zone must match the live page.
    var css =
      '.dsh-balance-chip{flex:none;margin-left:1px;font-size:12px;line-height:20px;' +
      'font-variant-numeric:tabular-nums;font-weight:400;letter-spacing:0;' +
      'color:var(--dsw-alias-label-secondary,#61666b);white-space:nowrap;' +
      'user-select:none;-webkit-user-select:none;pointer-events:auto}' +
      'button[data-collapsed="true"]>.dsh-balance-chip{display:none}' +
      '.dsh-balance-chip[hidden]{display:none}'

    var state = {
      text: null,
      title: null,
      signedOut: true,
    }
    var chip = null
    var disposed = false
    var pendingSync = false
    var refreshInFlight = null
    var observer = null
    var timer = 0

    // ---- release identity: the boot graph publishes the host release in every
    // page; fall back to the release this bundle was built against.
    function detectVersion() {
      try {
        var boot = window.__DSH_BOOT__
        if (boot && boot.release && typeof boot.release.version === 'string' && boot.release.version) {
          return boot.release.version
        }
        if (boot && typeof boot.version === 'string' && boot.version) return boot.version
      } catch (_error) {
        // fall through to the build-time release
      }
      return FALLBACK_VERSION
    }

    // ---- formatting (mirrors the Platform amount rules used by the account page)
    function currencySymbol(currency) {
      if (currency === 'CNY') return '\u00a5'
      if (currency === 'USD') return '$'
      return currency ? currency + ' ' : ''
    }

    function groupDigits(text) {
      var parts = text.split('.')
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return parts.join('.')
    }

    function formatWallet(amount, currency) {
      var symbol = currencySymbol(currency)
      var value = Number(amount)
      if (!isFinite(value)) return null
      if (value === 0) return symbol + '0.00'
      if (value < 0) {
        return '-' + symbol + (value > -0.01 ? '0.01' : groupDigits(Math.abs(value).toFixed(2)))
      }
      if (value < 0.01) return '<' + symbol + '0.01'
      // Platform truncates positive amounts to cents rather than rounding up.
      var truncated = Math.floor(value * 100) / 100
      return symbol + groupDigits(truncated.toFixed(2))
    }

    function walletList(wallets) {
      var parts = []
      for (var i = 0; i < wallets.length; i++) {
        var wallet = wallets[i]
        if (!wallet) continue
        var text = formatWallet(wallet.balance, wallet.currency)
        if (text !== null) parts.push(text)
      }
      return parts
    }

    function activeLocale(ctx) {
      try {
        var active = ctx.locale.getSnapshot().active
        if (typeof active === 'string' && active) return active
      } catch (_error) {
        // keep the default
      }
      return 'zh'
    }

    function buildTitle(ctx, toppedUp, bonus) {
      var zh = activeLocale(ctx).toLowerCase().indexOf('zh') === 0
      var lines = [
        (zh ? '\u5145\u503c\u4f59\u989d\uff1a' : 'Topped-up balance: ') +
          (toppedUp.length ? toppedUp.join(' / ') : zh ? '\u6682\u65e0' : 'none'),
      ]
      if (bonus.length) lines.push((zh ? '\u8d60\u91d1\u4f59\u989d\uff1a' : 'Granted balance: ') + bonus.join(' / '))
      return lines.join('\n')
    }

    // ---- DOM target: the sidebar account launcher (avatar + nickname)
    function findTrigger() {
      var direct = document.querySelector('button[data-signed-out]')
      if (direct) return direct
      var footer = document.querySelector('[class*="triggerRow"] button[aria-haspopup="menu"]')
      if (footer) return footer
      var footerArea = document.querySelector('[class*="footArea"] button[aria-haspopup="menu"]')
      if (footerArea) return footerArea
      return null
    }

    function ensureStyle() {
      var tag = document.querySelector('style[data-plugin-css="' + STYLE_ID + '"]')
      if (tag) return tag
      tag = document.createElement('style')
      tag.dataset.plugin = PLUGIN_ID
      tag.dataset.pluginCss = STYLE_ID
      tag.textContent = css
      ;(document.head || document.documentElement).appendChild(tag)
      return tag
    }

    function ensureChip() {
      var trigger = findTrigger()
      if (!trigger) return null
      var existing = trigger.querySelector(':scope > .dsh-balance-chip')
      if (existing) {
        chip = existing
        return chip
      }
      chip = document.createElement('span')
      chip.className = 'dsh-balance-chip'
      chip.setAttribute('data-dsh-balance-chip', '')
      chip.setAttribute('aria-label', 'DeepSeek balance')
      chip.hidden = true
      // Last child of the button => right after the nickname label span.
      trigger.appendChild(chip)
      return chip
    }

    function removeChip() {
      if (chip && chip.parentNode) chip.parentNode.removeChild(chip)
      chip = null
    }

    function paint() {
      var trigger = findTrigger()
      state.signedOut = !trigger || trigger.getAttribute('data-signed-out') === 'true'
      if (state.signedOut) {
        removeChip()
        return
      }
      var el = ensureChip()
      if (!el) return
      var text = state.text
      if (!text) {
        el.hidden = true
        el.textContent = ''
        el.removeAttribute('title')
        return
      }
      el.hidden = false
      if (el.textContent !== text) el.textContent = text
      if (state.title) el.title = state.title
      else el.removeAttribute('title')
    }

    function scheduleSync() {
      if (pendingSync || disposed) return
      pendingSync = true
      window.setTimeout(function () {
        pendingSync = false
        if (disposed) return
        try {
          paint()
        } catch (_error) {
          // never let a DOM hiccup break the shell
        }
      }, 180)
    }

    // ---- data: official account Remote, the same method the account settings
    // card uses for its "Topped-up balance" row.
    function clientMetadata(ctx) {
      return {
        version: detectVersion(),
        locale: activeLocale(ctx),
        timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
      }
    }

    function refresh(ctx) {
      if (disposed) return Promise.resolve()
      if (refreshInFlight) return refreshInFlight
      var run = (async function () {
        var result
        try {
          result = await ctx.remote.account.getBalance(clientMetadata(ctx))
        } catch (_error) {
          if (!disposed) {
            state.text = null
            state.title = null
            scheduleSync()
          }
          return
        }
        if (disposed) return
        var detail = result && result.ok ? result.value : undefined
        if (!detail || detail.status !== 'ready') {
          state.text = null
          state.title = null
          scheduleSync()
          return
        }
        var toppedUp = walletList(Array.isArray(detail.value) ? detail.value : [])
        var bonus = walletList(Array.isArray(detail.bonusWallets) ? detail.bonusWallets : [])
        state.text = toppedUp.length ? toppedUp.join(' ') : null
        state.title = state.text ? buildTitle(ctx, toppedUp, bonus) : null
        scheduleSync()
      })()
      refreshInFlight = run
      run.then(
        function () {
          if (refreshInFlight === run) refreshInFlight = null
        },
        function () {
          if (refreshInFlight === run) refreshInFlight = null
        },
      )
      return run
    }

    // ---- plugin lifecycle
    var inject = ['locale', 'remote', 'remote.account']

    function apply(ctx) {
      if (typeof document === 'undefined' || typeof window === 'undefined') return
      var onWake = function () {
        if (!document.hidden) void refresh(ctx)
      }
      ctx.effect(
        function () {
          disposed = false
          try {
            ensureStyle()
          } catch (_error) {
            // styling is cosmetic; keep going
          }
          try {
            observer = new MutationObserver(scheduleSync)
            observer.observe(document.body, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ['data-signed-out', 'data-collapsed'],
            })
          } catch (_error) {
            observer = null
          }
          document.addEventListener('visibilitychange', onWake)
          window.addEventListener('focus', onWake)
          timer = window.setInterval(function () {
            void refresh(ctx)
          }, REFRESH_MS)
          scheduleSync()
          void refresh(ctx)
          return function () {
            disposed = true
            if (observer) {
              observer.disconnect()
              observer = null
            }
            document.removeEventListener('visibilitychange', onWake)
            window.removeEventListener('focus', onWake)
            window.clearInterval(timer)
            timer = 0
            removeChip()
            var tag = document.querySelector('style[data-plugin-css="' + STYLE_ID + '"]')
            if (tag) tag.remove()
          }
        },
        'balance-chip: lifetime',
      )
    }

    exports.name = PLUGIN_ID
    exports.inject = inject
    exports.apply = apply
    return module.exports
  },
})
