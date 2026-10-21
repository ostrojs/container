import Application from '../src/application';

class ConfigService {
    port: number;
    host: string;
    options: { port: number; host: string };
    declare $app?: any;

    constructor(port: number = 3000, host: string = 'localhost') {
        this.port = port;
        this.host = host;
        this.options = { port, host };
    }

    getOptionCount(): number {
        return Object.keys(this.options).length;
    }
}

describe('Container Application Comprehensive Unit Tests', () => {

    let app: Application;

    beforeEach(() => {
        app = new Application();
    });

    describe('State Initialization & Configuration', () => {
        test('initializes container with empty structures and proper types', () => {
            expect(typeof app.$instances).toBe('object');
            expect(Object.keys(app.$instances).length).toBe(0);
            expect(typeof app.$bindings).toBe('object');
            expect(Object.keys(app.$bindings).length).toBe(0);
            expect(typeof app.$aliases).toBe('object');
            expect(Object.keys(app.$aliases).length).toBe(0);
        });

        test('getInstance() creates a new singleton if not set, setInstance() overrides it', () => {
            app.setInstance(null);
            const instance1 = app.getInstance();
            expect(instance1).toBeInstanceOf(Application);
            expect(typeof instance1).toBe('object');

            const customApp = new Application();
            app.setInstance(customApp);
            expect(app.getInstance()).toBe(customApp);
        });

        test('app() retrieves self or internal property', () => {
            expect(app.app()).toBe(app);
            expect(app.app() instanceof Application).toBe(true);

            app.customModule = { name: 'logger', version: '1.0' };
            const retrieved = app.app('customModule');
            expect(typeof retrieved).toBe('object');
            expect(retrieved.name).toBe('logger');
            expect(retrieved.version).toBe('1.0');
            expect(Object.keys(retrieved)).toHaveLength(2);
        });
    });

    describe('Instance & Binding Management', () => {
        test('instance() stores, retrieves, and checks object properties', () => {
            const configObj = { port: 8080, host: '127.0.0.1', tags: ['api', 'v1'] };
            const result = app.instance('config', configObj);

            expect(result).toBe(configObj);
            expect(typeof result).toBe('object');
            expect(Object.keys(result)).toEqual(['port', 'host', 'tags']);
            expect(result.tags).toHaveLength(2);
            expect(app.make('config')).toBe(configObj);
        });

        test('bind() registers transient class constructor and sets $app prototype', () => {
            app.bind('config', ConfigService, [8080, '127.0.0.1']);
            
            const bindings = app.getBindings();
            expect(typeof bindings).toBe('object');
            expect(Object.keys(bindings)).toContain('config');
            expect(bindings.config.shared).toBe(false);
            expect(bindings.config.parameters).toHaveLength(2);
            expect(bindings.config.parameters).toEqual([8080, '127.0.0.1']);

            const inst1 = app.make('config');
            const inst2 = app.make('config');

            expect(inst1).toBeInstanceOf(ConfigService);
            expect(inst2).toBeInstanceOf(ConfigService);
            expect(inst1).not.toBe(inst2);
            expect(inst1.port).toBe(8080);
            expect(inst1.host).toBe('127.0.0.1');
            expect(inst1.$app).toBe(app);
            expect(inst1.getOptionCount()).toBe(2);
        });

        test('bind() registers factory function returning class constructor', () => {
            app.singleton('factoryReturningClass', function() {
                return ConfigService;
            }, 9999, 'factoryHost');

            const inst = app.make('factoryReturningClass');
            expect(inst).toBeInstanceOf(ConfigService);
            expect(inst.port).toBe(9999);
            expect(inst.host).toBe('factoryHost');
        });

        test('bind() accepts an array of module names', () => {
            app.bind(['fs', 'path']);
            expect(app.bound('fs')).toBe(true);
            expect(app.bound('path')).toBe(true);
        });

        test('singleton() registers and caches shared instance', () => {
            app.singleton('sharedConfig', ConfigService, 9000, '0.0.0.0');

            const bindings = app.getBindings();
            expect(bindings.sharedConfig.shared).toBe(true);

            const inst1 = app.make('sharedConfig');
            const inst2 = app.make('sharedConfig');

            expect(inst1).toBeInstanceOf(ConfigService);
            expect(inst1).toBe(inst2);
            expect(inst1.port).toBe(9000);
            expect(inst1.host).toBe('0.0.0.0');
        });

        test('getOrCreateSingleton() creates binding if missing and returns instance', () => {
            app.getOrCreateSingleton('cachedSvc', ConfigService);
            const inst1 = app.make('cachedSvc');
            expect(inst1).toBeInstanceOf(ConfigService);

            const inst2 = app.make('cachedSvc');
            expect(inst2).toBe(inst1);
        });

        test('bound() accurately checks if abstract is registered as binding or instance', () => {
            app.bind('transientService', ConfigService);
            app.singleton('singletonService', ConfigService);

            expect(app.bound('transientService')).toBe(true);
            expect(app.bound('singletonService')).toBe(true);
            expect(app.bound('unboundService')).toBeFalsy();
        });

        test('makeWith() resolves class directly with parameters', () => {
            const inst = app.makeWith(ConfigService, 4000, '192.168.1.1');
            expect(inst).toBeInstanceOf(ConfigService);
            expect(inst.port).toBe(4000);
            expect(inst.host).toBe('192.168.1.1');
        });

        test('build() invokes plain function without class constructor', () => {
            function plainFactory(p1, p2) {
                return { sum: p1 + p2 };
            }
            const res = app.build(plainFactory, [10, 20]);
            expect(res).toEqual({ sum: 30 });
        });

        test('build() assigns $app on prototype if defined and not set', () => {
            function CustomProto() {
                return { custom: true };
            }
            CustomProto.prototype = {};
            const res = app.build(CustomProto);
            expect(res).toEqual({ custom: true });
            expect(CustomProto.prototype.$app).toBe(app);
        });

        test('bind() with string name and no callback requires the module', () => {
            app.bind('path');
            const res = app.make('path');
            expect(res).toBeDefined();
            expect(typeof res.join).toBe('function');
        });

        test('bind() when callback is string loads module via loadPath', () => {
            app.bind('customPathKey', 'path');
            const inst = app.make('customPathKey');
            expect(inst).toBeDefined();
            expect(typeof inst.join).toBe('function');
        });

        test('make() on module name string loads path when not bound', () => {
            const fsModule = app.make('fs');
            expect(fsModule).toBeDefined();
            expect(typeof fsModule.readFileSync).toBe('function');
        });

        test('loadPath() supports relative path starting with ./ and non-string dir', () => {
            const loaded = app.loadPath('./src/application');
            expect(loaded).toBeDefined();
            expect(app.loadPath({ direct: true })).toEqual({ direct: true });
        });

        test('loadPath() supports ~/ resolving against cwd or basePath()', () => {
            const loadedDefault = app.loadPath('~/src/application');
            expect(loadedDefault).toBeDefined();

            (app as any).basePath = () => __dirname;
            const loadedWithBasePath = app.loadPath('~/application.test');
            expect(loadedWithBasePath).toBeDefined();
            delete (app as any).basePath;
        });
    });

    describe('Aliasing & Path Resolution', () => {
        test('alias() sets global variables and getAlias() resolves recursively', () => {
            app.alias({ TestGlobalAlias: 'active' });
            expect(global.TestGlobalAlias).toBe('active');
            delete global.TestGlobalAlias;

            app.$aliases = {
                'app.config': 'config',
                'cfg': 'app.config'
            };
            expect(app.getAlias('cfg')).toBe('config');
            expect(app.getAlias('app.config')).toBe('config');
            expect(app.getAlias('unknown')).toBe('unknown');
        });
    });

    describe('Invocation & Execution Mechanics', () => {
        test('call() invokes callback factory function and array class method with arguments', () => {
            const sumFactory = function (container) {
                return function (a, b, c) {
                    return {
                        sum: a + b + c,
                        hasApp: !!this.$app,
                        argCount: arguments.length
                    };
                };
            };
            const result = app.call(sumFactory, [10, 20, 30]);

            expect(typeof result).toBe('object');
            expect(result.sum).toBe(60);
            expect(result.hasApp).toBe(true);
            expect(result.argCount).toBe(3);

            const controller = {
                multiply(a, b) {
                    return a * b;
                }
            };
            const product = app.call([controller, 'multiply'], [5, 6]);
            expect(typeof product).toBe('number');
            expect(product).toBe(30);
        });

        test('wrap() returns a callable closure and executes callback', () => {
            const compute = function (x, y) {
                return x + y;
            };
            const wrapped = app.wrap(compute, [15, 25]);

            expect(typeof wrapped).toBe('function');
            const mockContext = {
                apply(fn, params) {
                    return fn.apply(null, params);
                }
            };
            const val = wrapped.call(mockContext);
            expect(val).toBe(40);
        });

        test('factory() returns a function that resolves the abstract on demand', () => {
            app.bind('svc', ConfigService, [5000, 'localhost']);
            const factoryFn = app.factory('svc');

            expect(typeof factoryFn).toBe('function');
            const created = factoryFn();
            expect(created).toBeInstanceOf(ConfigService);
            expect(created.port).toBe(5000);
        });
    });

    describe('Helper Utilities & Environment Checks', () => {
        test('whenHas() executes done callback or error callback depending on property existence', () => {
            app.activeSetting = 'enabled';

            let doneCalled = false;
            let doneVal = null;
            app.whenHas('activeSetting', (val) => {
                doneCalled = true;
                doneVal = val;
            });
            expect(doneCalled).toBe(true);
            expect(doneVal).toBe('enabled');

            let errorCalled = false;
            app.whenHas('nonExistentKey', () => {}, () => {
                errorCalled = true;
            });
            expect(errorCalled).toBe(true);

            // test default arguments for done and error
            app.whenHas('activeSetting');
            app.whenHas('nonExistentKey');
        });

        test('environment() validates NODE_ENV against string or array', () => {
            const oldEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'staging';

            expect(app.environment('staging')).toBe(true);
            expect(app.environment(['development', 'staging', 'production'])).toBe(true);
            expect(app.environment('production')).toBe(false);
            expect(app.environment(['dev', 'test'])).toBe(false);

            process.env.NODE_ENV = oldEnv;
        });
    });

    describe('Cleanup & Proxy Accessors', () => {
        test('forgetInstance() and forgetInstances() purge instances from cache', () => {
            app.instance('i1', { id: 1 });
            app.instance('i2', { id: 2 });
            expect(Object.keys(app.$instances)).toHaveLength(2);

            app.forgetInstance('i1');
            expect(app.instance('i1')).toBeUndefined();
            expect(app.instance('i2')).toEqual({ id: 2 });

            app.forgetInstances();
            expect(Object.keys(app.$instances)).toHaveLength(0);
        });

        test('forgetScopedInstances() purges scoped instances', () => {
            app.$scopedInstances = { scoped1: true, scoped2: true };
            app.instance('scoped1', { val: 'a' });
            app.instance('scoped2', { val: 'b' });
            app.instance('normal', { val: 'c' });

            app.forgetScopedInstances();
            expect(app.instance('scoped1')).toBeUndefined();
            expect(app.instance('scoped2')).toBeUndefined();
            expect(app.instance('normal')).toEqual({ val: 'c' });
        });

        test('flush() resets all internal container state', () => {
            app.instance('inst', { a: 1 });
            app.bind('bnd', ConfigService);
            app.$aliases = { a: 'b' };
            app.$resolved = { r: true };
            app.$scopedInstances = { s: true };

            app.flush();

            expect(Object.keys(app.$instances)).toHaveLength(0);
            expect(Object.keys(app.$bindings)).toHaveLength(0);
            expect(Object.keys(app.$aliases)).toHaveLength(0);
            expect(Object.keys(app.$resolved)).toHaveLength(0);
            expect(Object.keys(app.$scopedInstances)).toHaveLength(0);
        });

        test('__get and __set proxy methods operate on target', () => {
            app.bind('config', ConfigService, [7000]);
            const resolved = app.__get(app, 'config');
            expect(resolved).toBeInstanceOf(ConfigService);
            expect(resolved.port).toBe(7000);

            app.__set(app, 'dynamicField', 'testing');
            expect(app.dynamicField).toBe('testing');
        });
    });

});
