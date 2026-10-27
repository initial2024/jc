window.__ModuleLoader__.load({
  id: 'dsh-relay-status-ui',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'relayStatusUi';

    const dictionaries = {
      zh: {
        active: 'Relay 增强已启用',
        compact: '工具状态将逐项显示，失败项不会掩盖成功项',
        preparing: '正在整理工具调用',
        running: '正在反馈兼容结果',
        skipped: '已跳过 {n} 项工具调用',
        noneSkipped: '没有跳过的工具调用',
        delivered: '跳过原因已反馈给模型',
        error: '兼容反馈执行失败',
        reason: '原因',
        detail: '详情',
        unknown: '未知工具',
      },
      en: {
        active: 'Relay UI active',
        compact: 'Tool calls are shown individually; failed calls do not hide successful ones',
        preparing: 'Preparing tool calls',
        running: 'Sending compatibility feedback',
        skipped: 'Skipped {n} tool call(s)',
        noneSkipped: 'No skipped tool calls',
        delivered: 'Skip reasons were returned to the model',
        error: 'Compatibility feedback failed',
        reason: 'Reason',
        detail: 'Details',
        unknown: 'Unknown tool',
      },
    };

    function textFromContent(content) {
      if (!Array.isArray(content)) return '';
      return content.map((item) => {
        if (!item || typeof item !== 'object') return '';
        if (item.type === 'text') return String(item.text || '');
        try { return JSON.stringify(item); } catch { return ''; }
      }).filter(Boolean).join('\n');
    }

    function rawArgs(phase, block) {
      if (!block || typeof block !== 'object') return '';
      if (phase === 'result') return block.call && typeof block.call.argsRaw === 'string' ? block.call.argsRaw : '';
      return typeof block.argsRaw === 'string' ? block.argsRaw : '';
    }

    function parseSkipped(phase, block) {
      const raw = rawArgs(phase, block);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.skipped)) return [];
        return parsed.skipped.filter((item) => item && typeof item === 'object').map((item) => ({
          name: typeof item.name === 'string' && item.name ? item.name : null,
          reason: typeof item.reason === 'string' ? item.reason : '',
          detail: typeof item.detail === 'string' ? item.detail : '',
        }));
      } catch {
        return [];
      }
    }

    function makeStyles() {
      return {
        card: {
          border: '1px solid color-mix(in srgb, currentColor 16%, transparent)',
          borderRadius: 12,
          padding: '10px 12px',
          margin: '4px 0',
          background: 'color-mix(in srgb, currentColor 4%, transparent)',
          color: 'inherit',
          fontSize: 13,
          lineHeight: 1.45,
        },
        header: {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontWeight: 600,
        },
        dot: {
          width: 8,
          height: 8,
          borderRadius: 999,
          background: 'currentColor',
          opacity: 0.7,
          flex: '0 0 auto',
        },
        sub: {
          opacity: 0.68,
          marginTop: 4,
          fontSize: 12,
        },
        item: {
          marginTop: 8,
          paddingTop: 8,
          borderTop: '1px solid color-mix(in srgb, currentColor 12%, transparent)',
        },
        code: {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: 12,
          overflowWrap: 'anywhere',
        },
        dock: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          maxWidth: '100%',
          padding: '5px 9px',
          borderRadius: 999,
          border: '1px solid color-mix(in srgb, currentColor 14%, transparent)',
          background: 'color-mix(in srgb, currentColor 3%, transparent)',
          color: 'inherit',
          fontSize: 11,
          opacity: 0.78,
        },
      };
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(
          () => ctx.locale.register(NS, dictionaries),
          'dsh-relay-status-ui: dictionaries',
        );
        const t = ctx.locale.bind(NS);
        const styles = makeStyles();

        function RelayDockBadge() {
          return h(
            'div',
            { style: styles.dock, title: t('compact'), 'data-relay-status-ui': 'active' },
            h('span', { style: styles.dot, 'aria-hidden': true }),
            h('span', null, t('active')),
          );
        }

        function FeedbackRow(props) {
          const phase = props.phase;
          const block = props.block;
          const skipped = parseSkipped(phase, block);
          const settled = phase === 'result';
          const failed = settled && Boolean(block && (block.isError || block.error));
          const output = settled ? textFromContent(block.content) : '';
          const title = failed
            ? t('error')
            : phase === 'preparing'
              ? t('preparing')
              : phase === 'start'
                ? t('running')
                : skipped.length
                  ? t('skipped').replace('{n}', String(skipped.length))
                  : t('noneSkipped');

          const children = [
            h(
              'div',
              { key: 'header', style: styles.header },
              h('span', { style: styles.dot, 'aria-hidden': true }),
              h('span', null, title),
            ),
          ];

          if (settled && !failed) {
            children.push(h('div', { key: 'delivered', style: styles.sub }, t('delivered')));
          }

          skipped.forEach((item, index) => {
            children.push(
              h(
                'div',
                { key: 'skip-' + index, style: styles.item },
                h('div', { style: styles.header }, item.name || t('unknown')),
                item.reason
                  ? h('div', { style: styles.sub }, t('reason') + ': ', h('span', { style: styles.code }, item.reason))
                  : null,
                item.detail
                  ? h('details', { style: styles.sub },
                      h('summary', null, t('detail')),
                      h('div', { style: styles.code }, item.detail))
                  : null,
              ),
            );
          });

          if (failed && output) {
            children.push(h('div', { key: 'error', style: styles.item }, h('div', { style: styles.code }, output)));
          }

          return h('div', { style: styles.card, 'data-relay-feedback-card': true }, ...children);
        }

        ctx.slots.inject('conversation.composer.dock', () =>
          ctx.slots.register(
            { name: 'conversation.composer.dock', id: 'relay-status-ui', order: 95 },
            RelayDockBadge,
          ),
        );

        ctx.slots.inject('tool.call.toolview', () =>
          ctx.slots.register(
            { name: 'tool.call.toolview', key: 'web_relay_compat_feedback' },
            FeedbackRow,
          ),
        );
      },
    };
  },
});
