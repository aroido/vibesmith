const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const POSTHOG_MODULE_PATH =
  '../.tmp-test-build/src/renderer/src/analytics/posthog.js';

function createStorageMock({
  throwOnGet = false,
  throwOnSet = false,
} = {}) {
  const store = new Map();

  return {
    clear() {
      store.clear();
    },
    getItem(key) {
      if (throwOnGet) throw new Error('storage_get_failed');
      return store.has(key) ? store.get(key) : null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      if (throwOnSet) throw new Error('storage_set_failed');
      store.set(key, String(value));
    },
  };
}

function installGlobal(name, value) {
  const hadValue = Object.prototype.hasOwnProperty.call(global, name);
  const previousValue = global[name];
  global[name] = value;

  return () => {
    if (hadValue) {
      global[name] = previousValue;
      return;
    }

    delete global[name];
  };
}

function flushAsyncWork() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

function runBeforeSend(context, captureEvent) {
  const beforeSend = context.fakeClient.config.before_send;
  assert.equal(typeof beforeSend, 'function');
  return beforeSend(captureEvent);
}

function loadPostHogModule({
  storage = createStorageMock(),
  analyticsIdentity = {
    distinctId: 'vbs-install-1234',
    scope: 'installation',
  },
  posthogKey = 'phc_test',
  allowWebdriver = false,
  navigatorWebdriver = false,
} = {}) {
  const restoreGlobalFns = [];
  const restoreLoad = Module._load;
  const captureCalls = [];
  const captureExceptionCalls = [];
  const emittedEvents = [];
  const fetchCalls = [];
  const startSessionRecordingCalls = [];
  let mainProcessExceptionListener = null;

  const fakeClient = {
    init(token, config) {
      fakeClient.token = token;
      fakeClient.config = config;
    },
    register() {},
    set_config() {},
    opt_in_capturing() {},
    opt_out_capturing() {},
    startSessionRecording(override) {
      startSessionRecordingCalls.push(override);
    },
    stopSessionRecording() {},
    sessionRecordingStarted() {
      return false;
    },
    get_session_replay_url() {
      return null;
    },
    get_distinct_id() {
      return analyticsIdentity.distinctId;
    },
    identify() {},
    calculateEventProperties(eventName, properties) {
      return {
        event: eventName,
        properties,
      };
    },
    _internalEventEmitter: {
      emit(eventName, payload) {
        emittedEvents.push({ eventName, payload });
      },
    },
    capture(eventName, properties) {
      captureCalls.push({ eventName, properties });
    },
    captureException(error, properties) {
      captureExceptionCalls.push({ error, properties });
    },
    startExceptionAutocapture() {},
    stopExceptionAutocapture() {},
  };

  const windowMock = {
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
    api: {
      async getAppVersion() {
        return '0.5.4-alpha.11';
      },
      async getAnalyticsIdentity() {
        return analyticsIdentity;
      },
      onAnalyticsMainProcessException(callback) {
        mainProcessExceptionListener = callback;
        return () => {
          if (mainProcessExceptionListener === callback) {
            mainProcessExceptionListener = null;
          }
        };
      },
    },
  };

  restoreGlobalFns.push(installGlobal('__VIBESMITH_POSTHOG_KEY__', posthogKey));
  restoreGlobalFns.push(
    installGlobal('__VIBESMITH_POSTHOG_HOST__', 'https://us.i.posthog.com')
  );
  restoreGlobalFns.push(
    installGlobal('__VIBESMITH_APP_VERSION__', '0.5.4-alpha.11')
  );
  restoreGlobalFns.push(installGlobal('__VIBESMITH_BUILD_FLAVOR__', 'internal'));
  restoreGlobalFns.push(
    installGlobal(
      '__VIBESMITH_POSTHOG_ALLOW_WEBDRIVER__',
      allowWebdriver ? 'true' : 'false'
    )
  );
  restoreGlobalFns.push(installGlobal('window', windowMock));
  restoreGlobalFns.push(installGlobal('localStorage', storage));
  restoreGlobalFns.push(
    installGlobal('navigator', {
      platform: 'MacIntel',
      language: 'ko-KR',
      webdriver: navigatorWebdriver,
    })
  );
  restoreGlobalFns.push(
    installGlobal(
      'fetch',
      async (input, init) => {
        const url =
          typeof input === 'string'
            ? input
            : input && typeof input.url === 'string'
              ? input.url
              : String(input);
        const body =
          typeof init?.body === 'string' ? init.body : null;

        fetchCalls.push({
          url,
          body,
          method: init?.method ?? 'GET',
        });

        if (url.includes('/config')) {
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                sessionRecording: true,
                errorTracking: { autocaptureExceptions: true },
                logs: { captureConsoleLogs: true },
                capturePerformance: { network_timing: true },
              };
            },
          };
        }

        return {
          ok: true,
          status: 200,
          async json() {
            return { status: 'Ok' };
          },
        };
      }
    )
  );
  restoreGlobalFns.push(
    installGlobal(
      'CustomEvent',
      class CustomEvent {
        constructor(type, init = {}) {
          this.type = type;
          this.detail = init.detail;
        }
      }
    )
  );

  Module._load = function patchedLoad(request, parent, isMain) {
    if (
      request === 'posthog-js' ||
      request === 'posthog-js/dist/module.full.no-external'
    ) {
      return fakeClient;
    }

    if (request === 'posthog-js/dist/posthog-recorder') {
      return {};
    }

    return restoreLoad.call(this, request, parent, isMain);
  };

  const modulePath = require.resolve(POSTHOG_MODULE_PATH);
  delete require.cache[modulePath];

  try {
    return {
      fakeClient,
      captureCalls,
      captureExceptionCalls,
      emittedEvents,
      fetchCalls,
      startSessionRecordingCalls,
      moduleExports: require(modulePath),
      emitMainProcessException(payload) {
        if (typeof mainProcessExceptionListener === 'function') {
          mainProcessExceptionListener(payload);
        }
      },
      modulePath,
      windowMock,
      cleanup() {
        delete require.cache[modulePath];
        Module._load = restoreLoad;
        while (restoreGlobalFns.length > 0) {
          const restore = restoreGlobalFns.pop();
          restore();
        }
      },
    };
  } catch (error) {
    Module._load = restoreLoad;
    while (restoreGlobalFns.length > 0) {
      const restore = restoreGlobalFns.pop();
      restore();
    }
    throw error;
  }
}

test('initializePostHog configures manual pageviews and replay masking', () => {
  const context = loadPostHogModule();

  try {
    context.moduleExports.initializePostHog();

    assert.equal(context.fakeClient.token, 'phc_test');
    assert.equal(context.fakeClient.config.capture_pageview, false);
    assert.equal(
      context.fakeClient.config.disable_external_dependency_loading,
      true
    );
    assert.equal(context.fakeClient.config.disable_session_recording, true);
    assert.equal(context.fakeClient.config.opt_out_useragent_filter, false);
    assert.equal(context.fakeClient.config.person_profiles, 'identified_only');
    assert.equal(
      context.fakeClient.config.mask_all_element_attributes,
      true
    );
    assert.deepEqual(context.fakeClient.config.property_denylist, [
      'password',
      'token',
      'access_token',
      'refresh_token',
      'authorization',
      'cookie',
      'set-cookie',
      'api_key',
      'apikey',
      'secret',
    ]);
    assert.deepEqual(context.fakeClient.config.session_recording, {
      blockSelector: '.ph-no-capture',
      maskAllInputs: true,
      maskTextSelector: '.analytics-mask-text',
    });
  } finally {
    context.cleanup();
  }
});

test('initializePostHog can allow webdriver analytics for E2E validation', () => {
  const context = loadPostHogModule({
    allowWebdriver: true,
  });

  try {
    context.moduleExports.initializePostHog();

    assert.equal(context.fakeClient.config.opt_out_useragent_filter, true);
  } finally {
    context.cleanup();
  }
});

test('before_send drops malformed $pageview events without a route', () => {
  const context = loadPostHogModule();

  try {
    context.moduleExports.initializePostHog();

    const result = runBeforeSend(context, {
      uuid: 'missing-route-pageview',
      event: '$pageview',
      properties: {
        $pathname: '/settings',
      },
    });

    assert.equal(result, null);
  } finally {
    context.cleanup();
  }
});

test('before_send preserves and normalizes valid manual $pageview events', () => {
  const context = loadPostHogModule();

  try {
    context.moduleExports.initializePostHog();

    const result = runBeforeSend(context, {
      uuid: 'manual-pageview',
      event: '$pageview',
      properties: {
        route: '  /settings?tab=monitoring#privacy  ',
        navigation_type: 'hash_change',
      },
    });

    assert.equal(result?.event, '$pageview');
    assert.equal(result?.properties.route, '/settings?tab=monitoring#privacy');
    assert.equal(result?.properties.navigation_type, 'hash_change');
  } finally {
    context.cleanup();
  }
});

test('analytics bridge status omits raw distinctId and storage failures fail closed', async () => {
  const context = loadPostHogModule({
    storage: createStorageMock({
      throwOnGet: true,
      throwOnSet: true,
    }),
  });

  try {
    context.moduleExports.initializePostHog();
    await flushAsyncWork();
    context.fakeClient.config.loaded(context.fakeClient);

    const status = context.windowMock.__vibesmithAnalytics.getStatus();

    assert.equal(
      Object.prototype.hasOwnProperty.call(status, 'distinctId'),
      false
    );
    assert.equal(status.enabled, false);
  } finally {
    context.cleanup();
  }
});

test('loaded analytics bootstrap forces replay start under manual control', async () => {
  const context = loadPostHogModule();

  try {
    context.moduleExports.initializePostHog();
    await flushAsyncWork();
    context.fakeClient.config.loaded(context.fakeClient);

    assert.deepEqual(context.startSessionRecordingCalls, [true]);
  } finally {
    context.cleanup();
  }
});

test('analytics bridge emits internal eventCaptured hooks for replay integrations', async () => {
  const context = loadPostHogModule();

  try {
    context.moduleExports.initializePostHog();
    await flushAsyncWork();
    context.fakeClient.config.loaded(context.fakeClient);

    context.windowMock.__vibesmithAnalytics.track('$pageview', {
      route: '/',
      navigation_type: 'initial_load',
    });

    assert.equal(
      context.emittedEvents.some(
        ({ eventName, payload }) =>
          eventName === 'eventCaptured' && payload.event === '$pageview'
      ),
      true
    );
  } finally {
    context.cleanup();
  }
});

test('analytics bridge drops malformed manual $pageview events before capture', async () => {
  const context = loadPostHogModule();

  try {
    context.moduleExports.initializePostHog();
    await flushAsyncWork();
    context.fakeClient.config.loaded(context.fakeClient);
    await flushAsyncWork();

    const emittedEventCount = context.emittedEvents.length;
    const eventRequestCount = context.fetchCalls.filter(
      (call) => call.url.includes('/e/') && call.body
    ).length;

    context.windowMock.__vibesmithAnalytics.track('$pageview', {
      route: '   ',
      navigation_type: 'hash_change',
    });
    await flushAsyncWork();

    assert.equal(context.emittedEvents.length, emittedEventCount);
    assert.equal(
      context.fetchCalls.filter((call) => call.url.includes('/e/') && call.body)
        .length,
      eventRequestCount
    );
  } finally {
    context.cleanup();
  }
});

test('buffers startup pageviews until analytics is ready', async () => {
  const context = loadPostHogModule();

  try {
    context.moduleExports.initializePostHog();
    context.windowMock.__vibesmithAnalytics.track('$pageview', {
      route: '/',
      navigation_type: 'initial_load',
    });

    assert.equal(
      context.fetchCalls.some((call) => {
        if (!call.url.includes('/e/') || !call.body) {
          return false;
        }

        return JSON.parse(call.body).event === '$pageview';
      }),
      false
    );

    await flushAsyncWork();
    context.fakeClient.config.loaded(context.fakeClient);
    await flushAsyncWork();

    assert.equal(
      context.fetchCalls.some((call) => {
        if (!call.url.includes('/e/') || !call.body) {
          return false;
        }

        return JSON.parse(call.body).event === '$pageview';
      }),
      true
    );
  } finally {
    context.cleanup();
  }
});

test('buffers forwarded main-process exceptions until analytics is ready', async () => {
  const context = loadPostHogModule();

  try {
    context.moduleExports.initializePostHog();
    context.emitMainProcessException({
      source: 'unhandled_rejection',
      message: 'Main process promise rejected',
      name: 'MainProcessUnhandledRejection',
      metadata: {
        origin: 'startup',
      },
    });

    assert.equal(context.captureExceptionCalls.length, 0);

    await flushAsyncWork();
    context.fakeClient.config.loaded(context.fakeClient);
    await flushAsyncWork();

    assert.equal(context.captureExceptionCalls.length, 1);
    assert.equal(
      context.captureExceptionCalls[0].properties.handled_by,
      'electron_main_process_bridge'
    );
    assert.equal(
      context.captureExceptionCalls[0].properties.exception_source,
      'unhandled_rejection'
    );
  } finally {
    context.cleanup();
  }
});
