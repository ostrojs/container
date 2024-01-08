require('@ostro/support/helpers')
const path = require('path')
const fs = require('fs')
const ObjectSet = require('lodash.set')
const { IsClass, isFunction, isset } = require('@ostro/support/function')
const ApplicationContract = require('@ostro/contracts/container/application')
const { Macroable } = require('@ostro/support/macro')

class Application extends Macroable.extend(ApplicationContract) {

    $instances = {};

    $bindings = {};

    $aliases = {};

    $resolved = {};

    $scopedInstances = {};

    alias(alias = {}) {
        for (let aliasKey in alias) {
            global[aliasKey] = alias[aliasKey];
        }
    }

    wrap($callback, $parameters = []) {
        return function () {
            return this.apply($callback, $parameters);
        };
    }

    call($callback, $parameters = []) {
        if (typeof $callback == 'function') {
            $callback = $callback(this)
        }
        if (Array.isArray($callback)) {
            $callback = $callback[0][$callback[1]].bind($callback[0])
        }
        return $callback.apply({ $app: this }, ...$parameters);
    }

    factory($abstract) {
        return () => {
            return this.make($abstract);
        };
    }

    makeWith($abstract, ...$parameters) {
        return this.make($abstract, ...$parameters);
    }

    make($abstract, ...$parameters) {
        return this.resolve($abstract, $parameters, true);
    }

    whenHas(key, done = () => { }, error = () => { }) {
        key = this[key]
        if (typeof key != undefined) {
            done(key)
        } else {
            error()
        }
    }

    resolve($abstract, $parameters = [], $make = false) {

        if (typeof $abstract == 'string') {

            if (this.$instances[$abstract]) {
                return this.$instances[$abstract]
            }
            let binding = this.$bindings[$abstract]

            if (binding) {
                let { callback, shared } = binding
                $parameters = binding.parameters
                let key = $abstract

                $abstract = callback
                if (shared && this.isBuildable($abstract)) {
                    if ((IsClass($abstract))) {
                        $abstract = new $abstract(...$parameters)
                    } else {
                        $abstract = $abstract.apply(null, [...$parameters])
                        if (IsClass($abstract)) {
                            $abstract.prototype.$app = this
                            $abstract = new $abstract(...$parameters)
                        }
                    }
                    this.$instances[key] = $abstract;
                    $abstract;
                }
            } else {
                if ($make) {
                    $abstract = this.loadPath($abstract)
                }

            }

        }

        $abstract = this.build($abstract, $parameters);

        return typeof $abstract == 'object' ? $abstract : undefined

    }

    loadPath(dir) {
        return typeof dir == 'string' ? require((dir.startsWith('./')) ? path.resolve(dir) : dir) : dir
    }

    isBuildable($concrete) {
        return typeof $concrete == 'function'
    }

    build($concrete, $parameters = []) {

        if (this.isBuildable($concrete)) {
            if ($concrete.prototype && typeof $concrete.prototype.$app == 'undefined') {
                $concrete.prototype.$app = this
            }
            if (IsClass($concrete)) {
                return new $concrete(...$parameters)
            } else {
                return $concrete.apply(null, $parameters);
            }
        } else {
            return $concrete
        }

    }

    getBindings() {
        return this.$bindings;
    }

    getAlias($abstract) {
        return isset(this.$aliases[$abstract])
            ? this.getAlias(this.$aliases[$abstract])
            : $abstract;
    }


    bind(key, callback, $parameters = [], shared = false) {
        if (typeof key == 'string' && !callback) {
            callback = require(key)
        }
        if (Array.isArray(key)) {
            key.map(key => {
                this.bind(key, this.loadPath(key), $parameters)
            })
        } else {
            if (this.isBuildable(callback)) {
                if (!IsClass(callback)) {
                    callback = callback.bind(null, this, ...$parameters)
                } else {
                    callback.prototype.$app = this
                }

            } else if (typeof callback == 'string') {
                return this.bind(key, callback, $parameters, $shared)
            }
        }
        this.$bindings[key] = { callback, shared, parameters: $parameters }

        return callback
    }

    bound(key) {
        return this.$bindings[key] && this.$bindings[key].shared == false
    }

    singleton($abstract, $concrete, ...$parameters) {
        return this.bind($abstract, $concrete, $parameters, true);
    }

    getOrCreateSingleton($abstract, $concrete) {

        if (!this.$instances[$abstract] && typeof $concrete == 'function') {
            this.singleton($abstract, $concrete);
        }
        return this.$instances[$abstract]

    }

    flush() {
        this.$aliases = {};
        this.$resolved = {};
        this.$bindings = {};
        this.$instances = {};
        this.$scopedInstances = {};
    }

    forgetInstance($abstract) {
        delete this.$instances[$abstract];
    }


    forgetInstances() {
        this.$instances = {};
    }

    forgetScopedInstances() {
        for (let $scoped in this.$scopedInstances) {
            delete this.$instances[$scoped];
        }
    }

    getInstance() {
        if (is_null(this.$instance)) {
            this.$instance = new this.constructor;
        }

        return this.$instance;
    }

    setInstance($container = null) {
        return this.$instance = $container;
    }

    app(key) {
        return key ? this[key] : this;
    }

    environment(environment) {
        environment = Array.isArray(environment) ? environment : [environment];
        return environment.includes(process.env.NODE_ENV)
    }

    forgetInstance($abstract) {
        delete this.$instances[$abstract];
    }

    instance($abstract, $instance) {

        if ($instance) {
            this.$instances[$abstract] = $instance
        }

        return this.$instances[$abstract];
    }

    __get(target, key) {
        return target.resolve(key)
    }

    __set(target, key, value) {
        target[key] = value;
    }

}

module.exports = Application
