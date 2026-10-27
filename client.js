window.__ModuleLoader__.load({
  id: 'dsh-relay-status-ui',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'relayStatusUi';
    const FEEDBACK_TOOL = 'web_relay_compat_feedback';
    const TURN_KEY = 'relay-ui-status';

    const dictionaries = {
      zh: {
        active: 'Relay 增强已启用',
        connected: '已连接',
        connecting: '连接中',
        disconnected: '未连接',
        context: '上下文',
        contextHigh: '上下文偏高',
        contextCritical: '接近上下文上限',
        modelUnknown: '模型未确定',
        attachments: '附件',
        submitting: '正在提交',
        queued: '排队',
        pending: '发送中',
        turnSummary: '本轮工具状态',
        success: '成功',
        failed: '失败',
        running: '执行中',
        skipped: '跳过',
        delivered: '跳过原因已反馈给模型',
        feedbackPending: '兼容反馈待结算',
        feedbackFailed: '兼容反馈失败',
        reason: '原因',
        detail: '详情',
        args: '参数',
        bashBroken: 'Bash 会话目录已失效',
        bashBrokenHint: '检测到 persistent bash 的 cwd/inode 异常。当前无公开的安全重置接口；请新建会话或重启 DSH 后再使用 bash。',
        more: '更多',
        duplicate_of_native_call: '与原生工具调用重复，已抑制副本',
        tool_not_available: '当前工具未注册',
        schema_validation_failed: '参数不符合工具 Schema',
        arguments_not_object: '工具参数不是 JSON 对象',
        schema_validation_unavailable: 'Schema 校验不可用',
        uiOnly: '仅界面增强，不接管工具执行',
      },
      en: {
        active: 'Relay UI active',
        connected: 'Connected',
        connecting: 'Connecting',
        disconnected: 'Disconnected',
        context: 'Context',
        contextHigh: 'Context pressure high',
        contextCritical: 'Near context limit',
        modelUnknown: 'Model unknown',
        attachments: 'Attachments',
        submitting: 'Submitting',
        queued: 'Queued',
        pending: 'Sending',
        turnSummary: 'Tool status this turn',
        success: 'Success',
        failed: 'Failed',
        running: 'Running',
        skipped: 'Skipped',
        delivered: 'Skip reasons returned to the model',
        feedbackPending: 'Compatibility feedback pending',
        feedbackFailed: 'Compatibility feedback failed',
        reason: 'Reason',
        detail: 'Details',
        args: 'Arguments',
        bashBroken: 'Bash working directory is invalid',
        bashBrokenHint: 'Persistent bash reported a cwd/inode failure. No public safe reset API is exposed; start a new session or restart DSH before using bash again.',
        more: 'more',
        duplicate_of_native_call: 'Duplicate of a native tool call; copy suppressed',
        tool_not_available: 'Tool is not registered',
        schema_validation_failed: 'Arguments do not match the tool schema',
        arguments_not_object: 'Arguments are not a JSON object',
        schema_validation_unavailable: 'Schema validation unavailable',
        uiOnly: 'Presentation only; does not execute tools',
      },
    };

    function contentText(content) {
      if (!Array.isArray(content)) return '';
      return content.map((part) => {
        if (part && typeof part === 'object' && part.type === 'text') return String(part.text || '');
        return '';
      }).filter(Boolean).join('\n');
    }

    function parseJson(text) {
      if (typeof text !== 'string' || text.length === 0) return null;
      try {
        const value = JSON.parse(text);
        return value && typeof value === 'object' ? value : null;
      } catch {
        return null;
      }
    }

    function parseSkippedArguments(raw) {
      const parsed = parseJson(raw);
      if (!parsed || !Array.isArray(parsed.skipped)) return [];
      return parsed.skipped
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
          name: typeof item.name === 'string' && item.name ? item.name : 'unknown',
          reason: typeof item.reason === 'string' ? item.reason : 'unknown',
          detail: typeof item.detail === 'string' ? item.detail : '',
        }));
    }

    function bashCwdBroken(text) {
      if (typeof text !== 'string') return false;
      const value = text.toLowerCase();
      return value.includes("couldn't find directory entry in '.' with matching inode")
        || value.includes('cannot access parent directories')
        || value.includes('getcwd') && value.includes('no such file or directory');
    }

    function visibleStatus(state) {
      const calls = [...state.calls.values()]
        .filter((call) => call.name !== FEEDBACK_TOOL)
        .map((call) => ({ ...call }));
      return {
        calls,
        skipped: [...state.skipped],
        feedback: state.feedback,
        bashIssue: state.bashIssue,
      };
    }

    const relayTurnDefinition = {
      kind: TURN_KEY,
      match(event) {
        if (event.type === 'turn/start') return { id: String(event.data.turn), role: 'start' };
        if (event.type === 'tool/call' || event.type === 'tool/result' || event.type === 'turn/end') {
          return { id: String(event.data.turn), role: 'update' };
        }
        return null;
      },
      start(_context, match) {
        if (match.event.type !== 'turn/start') throw new Error('relay-ui-status requires turn/start');
        return {
          turn: match.event.data.turn,
          calls: new Map(),
          skipped: [],
          feedback: 'none',
          bashIssue: null,
        };
      },
      update(context, match) {
        const event = match.event;
        if (event.type === 'tool/call') {
          const calls = new Map(context.state.calls);
          const callId = String(event.data.callId);
          calls.set(callId, {
            callId,
            name: String(event.data.name || 'unknown'),
            args: typeof event.data.arguments === 'string' ? event.data.arguments : '',
            status: 'running',
          });
          if (event.data.name === FEEDBACK_TOOL) {
            return {
              ...context.state,
              calls,
              skipped: parseSkippedArguments(event.data.arguments),
              feedback: 'pending',
            };
          }
          return { ...context.state, calls };
        }
        if (event.type === 'tool/result') {
          const calls = new Map(context.state.calls);
          const callId = String(event.data.message?.source?.callId || '');
          const previous = calls.get(callId);
          const failed = event.data.message?.isError === true;
          if (previous) calls.set(callId, { ...previous, status: failed ? 'failed' : 'success' });
          const output = contentText(event.data.message?.content);
          const feedback = previous?.name === FEEDBACK_TOOL
            ? (failed ? 'failed' : 'delivered')
            : context.state.feedback;
          const bashIssue = previous?.name === 'bash' && bashCwdBroken(output)
            ? output
            : context.state.bashIssue;
          return { ...context.state, calls, feedback, bashIssue };
        }
        return context.state;
      },
      buildLocationData(context, scope, previous) {
        if (scope !== 'turn' || !context.state) return null;
        const value = visibleStatus(context.state);
        const serialized = JSON.stringify(value);
        if (previous?.kind === 'turn'
          && previous.turn === context.state.turn
          && previous.key === TURN_KEY
          && JSON.stringify(previous.value) === serialized) return previous;
        return {
          kind: 'turn',
          turn: context.state.turn,
          key: TURN_KEY,
          value,
        };
      },
    };

    function styles() {
      return {
        pill: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          maxWidth: '100%',
          padding: '5px 9px',
          borderRadius: 999,
          border: '1px solid color-mix(in srgb, currentColor 14%, transparent)',
          background: 'color-mix(in srgb, currentColor 3%, transparent)',
          color: 'inherit',
          fontSize: 11,
          opacity: 0.82,
          whiteSpace: 'nowrap',
        },
        dockWrap: {
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          maxWidth: '100%',
        },
        dot: {
          width: 8,
          height: 8,
          borderRadius: 999,
          background: 'currentColor',
          opacity: 0.72,
          flex: '0 0 auto',
        },
        card: {
          border: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
          borderRadius: 14,
          padding: '11px 12px',
          margin: '8px 0 2px',
          background: 'color-mix(in srgb, currentColor 4%, transparent)',
          color: 'inherit',
          fontSize: 13,
          lineHeight: 1.45,
        },
        header: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          fontWeight: 650,
        },
        rows: {
          display: 'grid',
          gap: 7,
          marginTop: 9,
        },
        row: {
          display: 'grid',
          gridTemplateColumns: '18px minmax(0,1fr) auto',
          gap: 7,
          alignItems: 'start',
          paddingTop: 6,
          borderTop: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
        },
        statusOk: { fontWeight: 700, opacity: 0.85 },
        statusSkip: { fontWeight: 700, opacity: 0.65 },
        statusFail: { fontWeight: 700 },
        name: {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          overflowWrap: 'anywhere',
        },
        meta: { opacity: 0.64, fontSize: 11 },
        details: { marginTop: 4, opacity: 0.82 },
        code: {
          display: 'block',
          marginTop: 4,
          padding: '6px 7px',
          borderRadius: 8,
          background: 'color-mix(in srgb, currentColor 6%, transparent)',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: 11,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        },
        warning: {
          marginTop: 9,
          padding: '9px 10px',
          borderRadius: 10,
          border: '1px solid color-mix(in srgb, currentColor 24%, transparent)',
          background: 'color-mix(in srgb, currentColor 7%, transparent)',
        },
        inputNotice: {
          margin: '0 8px 6px',
          padding: '7px 10px',
          borderRadius: 10,
          border: '1px solid color-mix(in srgb, currentColor 12%, transparent)',
          fontSize: 12,
          opacity: 0.82,
        },
      };
    }

    function reasonLabel(t, reason) {
      const known = new Set([
        'duplicate_of_native_call',
        'tool_not_available',
        'schema_validation_failed',
        'arguments_not_object',
        'schema_validation_unavailable',
      ]);
      return known.has(reason) ? t(reason) : reason;
    }

    return {
      inject: ['slots', 'locale', 'uiConversation', 'connection'],
      apply(ctx) {
        ctx.effect(
          () => ctx.locale.register(NS, dictionaries),
          'dsh-relay-status-ui: dictionaries',
        );
        ctx.effect(
          () => ctx.uiConversation.events.register(relayTurnDefinition),
          'dsh-relay-status-ui: turn status projection',
        );

        const t = ctx.locale.bind(NS);
        const s = styles();

        function RelayDockBadge(props) {
          const connection = props.useRelayConnection ? props.useRelayConnection((value) => value) : undefined;
          const modelProjection = props.useProjection ? props.useProjection('modelSelection') : undefined;
          const pressure = props.useProjection ? props.useProjection('contextPressure') : undefined;
          const selected = modelProjection?.next || modelProjection?.lastUsed || null;
          const used = pressure?.projectedTokens ?? pressure?.pressureTokens;
          const capacity = pressure?.contextWindow;
          const ratio = typeof used === 'number' && typeof capacity === 'number' && capacity > 0
            ? used / capacity
            : null;
          const contextText = ratio === null
            ? null
            : t('context') + ' ' + Math.round(ratio * 100) + '%';
          const connectionText = connection === 'connected'
            ? t('connected')
            : connection === undefined || connection === 'connecting'
              ? t('connecting')
              : t('disconnected');
          const modelText = selected
            ? String(selected.provider) + ' / ' + String(selected.model)
            : t('modelUnknown');

          return h('div', { style: s.dockWrap, 'data-relay-status-ui': 'active' },
            h('span', { style: s.pill, title: t('uiOnly') },
              h('span', { style: s.dot, 'aria-hidden': true }),
              t('active')),
            h('span', { style: s.pill }, connectionText),
            h('span', { style: s.pill }, modelText),
            contextText ? h('span', {
              style: s.pill,
              title: ratio >= 0.9 ? t('contextCritical') : ratio >= 0.8 ? t('contextHigh') : contextText,
            }, contextText + (ratio >= 0.9 ? ' !' : '')) : null,
          );
        }

        function DraftStatus(props) {
          const input = props.input;
          const session = props.session;
          const attachments = Array.isArray(input?.attachmentIds) ? input.attachmentIds.length : 0;
          const queue = Array.isArray(input?.queue) ? input.queue.length : 0;
          const pending = Array.isArray(session?.pendingSubmissions) ? session.pendingSubmissions.length : 0;
          const busy = input?.phase && input.phase !== 'plain';
          if (!attachments && !queue && !pending && !busy) return null;
          const parts = [];
          if (attachments) parts.push(t('attachments') + ' ' + attachments);
          if (busy) parts.push(t('submitting') + ' · ' + input.phase);
          if (queue) parts.push(t('queued') + ' ' + queue);
          if (pending) parts.push(t('pending') + ' ' + pending);
          return h('div', { style: s.inputNotice, 'data-relay-draft-status': true }, parts.join(' · '));
        }

        function TurnSummary(props) {
          const data = props.turn?.data?.get ? props.turn.data.get(TURN_KEY) : undefined;
          if (!data) return null;
          const calls = Array.isArray(data.calls) ? data.calls : [];
          const skipped = Array.isArray(data.skipped) ? data.skipped : [];
          if (calls.length === 0 && skipped.length === 0 && !data.bashIssue) return null;

          const rows = [];
          calls.slice(0, 8).forEach((call, index) => {
            const status = call.status || 'running';
            const icon = status === 'success' ? '✓' : status === 'failed' ? '×' : '…';
            const label = status === 'success' ? t('success') : status === 'failed' ? t('failed') : t('running');
            rows.push(h('div', { key: 'call-' + index, style: s.row },
              h('span', { style: status === 'failed' ? s.statusFail : s.statusOk }, icon),
              h('div', null,
                h('div', { style: s.name }, call.name),
                call.args ? h('details', { style: s.details },
                  h('summary', null, t('args')),
                  h('code', { style: s.code }, call.args)) : null),
              h('span', { style: s.meta }, label),
            ));
          });

          skipped.slice(0, 8).forEach((item, index) => {
            rows.push(h('div', { key: 'skip-' + index, style: s.row },
              h('span', { style: s.statusSkip }, '⊘'),
              h('div', null,
                h('div', { style: s.name }, item.name || 'unknown'),
                h('div', { style: s.meta }, t('reason') + ': ' + reasonLabel(t, item.reason || 'unknown')),
                item.detail ? h('details', { style: s.details },
                  h('summary', null, t('detail')),
                  h('code', { style: s.code }, item.detail)) : null),
              h('span', { style: s.meta }, t('skipped')),
            ));
          });

          const feedbackText = data.feedback === 'delivered'
            ? t('delivered')
            : data.feedback === 'failed'
              ? t('feedbackFailed')
              : data.feedback === 'pending'
                ? t('feedbackPending')
                : null;

          return h('section', { style: s.card, 'data-relay-turn-summary': true },
            h('div', { style: s.header },
              h('span', null, t('turnSummary')),
              feedbackText ? h('span', { style: s.meta }, feedbackText) : null),
            h('div', { style: s.rows }, ...rows),
            calls.length > 8 || skipped.length > 8
              ? h('div', { style: s.meta }, '+ ' + (Math.max(0, calls.length - 8) + Math.max(0, skipped.length - 8)) + ' ' + t('more'))
              : null,
            data.bashIssue ? h('div', { style: s.warning },
              h('div', { style: s.header }, t('bashBroken')),
              h('div', { style: s.meta }, t('bashBrokenHint')),
            ) : null,
          );
        }

        function rawFeedbackArgs(phase, block) {
          if (!block || typeof block !== 'object') return '';
          if (phase === 'result') return typeof block.call?.argsRaw === 'string' ? block.call.argsRaw : '';
          return typeof block.argsRaw === 'string' ? block.argsRaw : '';
        }

        function FeedbackRow(props) {
          const skipped = parseSkippedArguments(rawFeedbackArgs(props.phase, props.block));
          const settled = props.phase === 'result';
          const failed = settled && Boolean(props.block?.isError || props.block?.error);
          const title = failed
            ? t('feedbackFailed')
            : skipped.length
              ? t('skipped') + ' ' + skipped.length
              : t('feedbackPending');

          return h('div', { style: s.card, 'data-relay-feedback-card': true },
            h('div', { style: s.header }, title),
            skipped.length ? h('div', { style: s.rows }, ...skipped.map((item, index) =>
              h('div', { key: index, style: s.row },
                h('span', { style: s.statusSkip }, '⊘'),
                h('div', null,
                  h('div', { style: s.name }, item.name),
                  h('div', { style: s.meta }, reasonLabel(t, item.reason)),
                  item.detail ? h('details', { style: s.details },
                    h('summary', null, t('detail')),
                    h('code', { style: s.code }, item.detail)) : null),
                h('span', { style: s.meta }, t('skipped')),
              ))) : null,
            settled && !failed ? h('div', { style: s.meta }, t('delivered')) : null,
          );
        }

        ctx.slots.inject('conversation.composer.dock', () =>
          ctx.slots.register({
            name: 'conversation.composer.dock',
            id: 'relay-status-ui',
            order: 95,
            inject: () => ({ hooks: { relayConnection: ctx.connection.state } }),
          }, RelayDockBadge),
        );

        ctx.slots.inject('conversation.input.dock', () =>
          ctx.slots.register({
            name: 'conversation.input.dock',
            id: 'relay-draft-status',
            order: 95,
          }, DraftStatus),
        );

        ctx.slots.inject('tool.call.toolview', () =>
          ctx.slots.register({
            name: 'tool.call.toolview',
            key: FEEDBACK_TOOL,
          }, FeedbackRow),
        );

        ctx.slots.inject('conversation.chat.turnTail', () =>
          ctx.slots.register({
            name: 'conversation.chat.turnTail',
            id: 'relay-turn-summary',
            order: 95,
          }, TurnSummary),
        );
      },
    };
  },
});