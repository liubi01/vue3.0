/**
 * 1 当属性值修改时值相同时不需要触发副作用--在set中判断 
 * 2.解决NAN的判断 
 * 3.原型上继承属性问题（reflect会在原型链上查找属性）会根据原型链触发两次set trigger所屏蔽parent那一次
 * 4.数组数据的操作与响应：depsmap中 key为 length或者索引值，并且这两个depsKey可能会互相影响如修改length或影响下标（key>=length）的值
 *   --修改key如果是新增的花（arr[3]=1 3大于length）那么ADD的操作会修改length
 *   --for...in中的遍历中当修改length时会改变for...in 所以要数组在for...in时track length值
 *   --for...of中遍历值，会默认读取数组的Symbol.iterator这个属性方法就会默认给他设置key的回调方法所以要过滤调（因为他为隐式调用没有必要响应浪费性能）
 *   --includes(此类查找方法): 在代理对象数组中所有的内部对象（obj）也是代理对象，如果 arr.includes(obj) 其实查找的是obj这个原始对象所以找不到（arr.include(arr[0])是可以的），所以需要从写includes目的通过get拦截它让其this指向代理对象并查找
 *   --push(此类隐式修改数组长度的方法=)会隐式的访问length属性和设置length属性 有可能会造成无限循环问题所有有重写添加shouldTrack判断其执行 
 * 5.代理set和map数据类型
 *    --size属性代理对象调用时需要配置他的this指向
 *    --delete方法 target[key].bind(target) 用于绑定this指向target原始数据对象
 *    --add方法，会触发size的变化所以副作用函数与size一样其key为ITERATE_KEY，
 *   map的get/set方法
 *    --调用get方法时也需要track当前的key,所以重写map的get方法
 *    --
 *    --数据污染：把响应式数据设置到原始数据上的行为称为数据污染（add、set.普通对象的写值），因为操作响应式的数据会变像让原始数据变为响应式所以需要在数据设置时候获取原始数据来设置值(rawValue)
 *    --foreach: 需要响应key和value 所以在foreach中要深度响应这两个值
 *    --迭代器：for...of中迭代器被调用所以需要track他的回调方法到ITERATE_KEY中并且需要深度响应
 */

// 全局变量存储被注册的副作用函数
let activeEffect;
const effectStack = [];
const TriggerType = {
    SET: 'SET',
    ADD: 'ADD',
    DELETE: 'DELETE'
}
// effect 函数用于注册副作用函数
function effect(fn) {
    const effectFn = () => {
        console.log('effect start');
        cleanup(effectFn);
        activeEffect = effectFn;
        effectStack.push(effectFn)
        fn();
        console.log('effect end');
        effectStack.pop();
        activeEffect = effectStack[effectStack.length - 1]
    }
    effectFn.deps = [];
    effectFn();
}

const bucket = new WeakMap();

const data = {
    foo: 1,
    bar: 2
}
const ITERATE_KEY = Symbol('iterate key')

const reactiveMap = new Map();

function reactive(data) {
    const existionProxy = reactiveMap.get(data);
    if (existionProxy) return existionProxy;

    const proxy = createReactive(data);
    reactiveMap.set(data, proxy);
    return proxy
}

function shallowReactive(data) {
    return createReactive(data, true);
}

function readonly(data) {
    return createReactive(data, false, true);
}

function shallowReadonly(data) {
    return createReactive(data, true, true);
}

function createReactive(data, isShallow = false, isReadonly = false) {
    return new Proxy(data, {
        get(target, key, receiver) {
            if (key === 'raw') { // proxy.raw可以取得他的代理对象target
                return target
            }

            if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
                return Reflect.get(arrayInstrumentations, key, receiver);
            }
            if (!isReadonly && typeof key !== 'symbol') {
                track(target, key)
            }
            let res = null;
            if (key === 'size') {
                track(target, ITERATE_KEY);
                return Reflect.get(target, key, target)
            }
            if (target instanceof Set || target instanceof Map) {
                if (mutableInstrumentations.hasOwnProperty(key)) {
                    return mutableInstrumentations[key];
                } else {
                    return target[key].bind(target);
                }
            }
            res = Reflect.get(...arguments)
            if (isShallow) {
                return res;
            }
            if (typeof res === 'object' && res !== null) {
                return isReadonly ? readonly(res) : reactive(res);
            }
            return res
        },
        set(target, key, newValue, receiver) {
            if (isReadonly) {
                console.warn(`属性${key}是只读的`);
                return true;
            }
            const oldValue = target[key]
            // 区分触发的set是添加属性还是set一个属性
            const type = Array.isArray(target) ?
                Number(key) > target.length ? TriggerType.SET : TriggerType.ADD :
                Object.prototype.hasOwnProperty.call(target, key) ? TriggerType.SET : TriggerType.ADD;
            const res = Reflect.set(target, key, newValue, receiver)
            if (target === receiver.raw) { // raw来获取代理对象的原始对象是谁，判断是否为target（原始对象），不相等为父以上对象
                if (oldValue !== newValue && (oldValue === oldValue || newValue === newValue)) { // 同时避免NAN的比较
                    trigger(target, key, type, newValue) // 把副作用函数取出并执行
                }
            }
            return res
        },
        // 如 ‘foo’ in obj;
        has(target, p) { // 拦截 in 操作符, in操作符内部最终调用了对象的[[HasProperty]]内部方法，该内部方法可以被Proxy的has拦截函数拦截
            track(target, p)
            return Reflect.has(target, p)
        },
        ownKeys(target) { // 拦截 for in 循环，只有target参数
            track(target, Array.isArray(target) ? 'length' : ITERATE_KEY) // ITERATE_KEY 特别带出的一个key for in 中特有
            return Reflect.ownKeys(target)
        },
        deleteProperty(target, key) {
            if (isReadonly) {
                console.warn(`属性${key}是只读的`);
                return true;
            }
            const hasKey = Object.prototype.hasOwnProperty.call(target, key);
            const res = Reflect.deleteProperty(target, key);
            if (res && hasKey) { // 只有是删除自有属性的时候，再触发trigger (for in中)
                trigger(target, key, 'DELETE') // delete是为了让trigger也触发for  in的副作用函数
            }

        }
    })
}


function track(target, key) {
    console.log('track');
    // if (!activeEffect || !shouldTrack) return target[key]
    if (!activeEffect || !shouldTrack) return
    let depsMap = bucket.get(target);
    if (!depsMap) {
        bucket.set(target, (depsMap = new Map()));
    }
    let deps = depsMap.get(key);
    if (!deps) {
        depsMap.set(key, (deps = new Set()))
    }
    deps.add(activeEffect);
    activeEffect.deps.push(deps);
}

function trigger(target, key, type, newVal) {
    const depsMap = bucket.get(target);
    if (!depsMap) return
    const effects = depsMap.get(key);
    const iterateEffects = depsMap.get(ITERATE_KEY)
    const effectsToRun = new Set();
    // 如果操作是数组 并且修改了数组的length属性(arr[3] 3大于length 或者直接修改length)
    if (Array.isArray(target) && key === 'length') {
        depsMap.forEach((effects, key) => {
            if (key >= newVal) { // 修改arr的某一个以后下标值
                effects.forEach(effectFn => {
                    if (effectFn !== activeEffect) {
                        effectsToRun.add(effectFn);
                    }
                })
            }
        })
    }
    // 如果操作的是数组 类型为add操作
    if (type === TriggerType.ADD && Array.isArray(target)) {
        const lengthEffects = depsMap.get('length');
        lengthEffects && lengthEffects.forEach(effectFn => {
            if (effectFn !== activeEffect) {
                effectsToRun.add(effectFn);
            }
        })
    }
    effects && effects.forEach(effectFn => {
        if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn);
        }
    })
    if (type === TriggerType.ADD || type === TriggerType.DELETE || (type === TriggerType.SET && Object.prototype.toString.call(target) === '[object Map]')) {
        iterateEffects && iterateEffects.forEach(effectFn => {
            if (effectFn !== activeEffect) {
                effectsToRun.add(effectFn);
            }
        })
    }
    if ((type === TriggerType.ADD || type === TriggerType.DELETE) && Object.prototype.toString.call(target) === '[object Map]') {
        const iterateEffects = depsMap.get(MAP_KEY_ITERATE);
        iterateEffects && iterateEffects.forEach(effectFn => {
            if (effectFn !== activeEffect) {
                effectsToRun.add(effectFn);
            }
        })
    }
    effectsToRun.forEach(effectFn => {
        effectFn();
    })

}

function cleanup(effectFn) {
    for (let index = 0; index < effectFn.deps.length; index++) {
        const deps = effectFn.deps[index];
        deps.delete(effectFn);
    }
    effectFn.deps.length = 0;
}

// 重写arrary的方法
const arrayInstrumentations = {};
let shouldTrack = true;
// 为了符合查找代理对象或者查找原始对象都满足能找到的预期，重写一下方法
['include', 'indexOf', 'lastIndexOf'].forEach(method => {
    const originMethod = Array.prototype[method];
    arrayInstrumentations[method] = function (...args) {
        let res = originMethod.apply(this, args);
        if (res === false) {
            res = originMethod.apply(this.raw, args);
        }
        return res;
    }
})


; // 会改变length的长短
['push', 'pop', 'shift', 'unshift', 'splice'].forEach(method => {
    const originMethod = Array.prototype[method];
    arrayInstrumentations[method] = function (...args) {
        shouldTrack = false; // 禁止跟踪（push等会修改length属性，如有多个副作用函数与length有关会导致length的无限执行栈溢出）
        let res = originMethod.apply(this, args);
        shouldTrack = true;
        return res;
    }
})
// 从写set、map的方法
const mutableInstrumentations = {
    add(key) {
        const target = this.raw;
        let res = null;
        const hadKey = target.has(key);
        if (!hadKey) {
            res = target.add(key);
            trigger(target, key, TriggerType.ADD);
        }
        return res;
    },
    delete(key) {
        const target = this.raw;
        const hadKey = target.has(key);
        const res = target.delete(key);
        if (hadKey) {
            trigger(target, key, TriggerType.DELETE);
        }
        return res;
    },
    get(key) {
        const target = this.raw;
        const had = target.has(key);
        track(target, key);
        if (had) {
            const res = target.get(key);
            return typeof res === 'object' ? reactive(res) : res;
        }
    },
    set(key, value) {
        const target = this.raw;
        const had = target.has(key);
        const oldValue = target.get(key);
        const rawValue = value.raw || value;
        target.set(key, rawValue)
        if (!had) {
            trigger(target, key, TriggerType.ADD);
        } else if (oldValue !== value || (oldValue === oldValue && value === value)) {
            trigger(target, key, TriggerType.SET);
        }
    },
    forEach(callback, thisArg) {
        const wrap = (val) => typeof val === 'object' && val !== null ? reactive(val) : val;
        const target = this.raw;
        track(target, ITERATE_KEY);
        target.forEach((v, k) => {
            callback.call(thisArg, wrap(v), wrap(k), this);
        });
    },
    [Symbol.iterator]: iterateMethod,
    entries: iterateMethod,
    values: function () {
        return valuesIterateMethod('values').call(this)
    },
    keys: function () {
        return valuesIterateMethod('keys').call(this)
    },
}

function iterateMethod() {
    const wrap = (val) => typeof val === 'object' && val !== null ? reactive(val) : val;
    const target = this.raw;
    const itr = target[Symbol.iterator]();
    track(target, ITERATE_KEY);
    return {
        next() {
            const {
                value,
                done
            } = itr.next();
            return {
                value: value ? [wrap(value[0]), wrap(value[1])] : value,
                done
            }
        },
        [Symbol.iterator]() {
            return this;
        }
    }
}

const MAP_KEY_ITERATE = Symbol();

function valuesIterateMethod(type) {

    return function () {
        const wrap = (val) => typeof val === 'object' && val !== null ? reactive(val) : val;
        const target = this.raw;
        const itr = target[type]();
        track(target, type === 'keys' ? MAP_KEY_ITERATE : ITERATE_KEY);
        return {
            next() {
                const {
                    value,
                    done
                } = itr.next();
                return {
                    value: wrap(value),
                    done
                }
            },
            [Symbol.iterator]() {
                return this;
            }
        }
    }

}
let arr = reactive(['arr1']);
effect(() => {
    // for (const key in obj) {
    //     console.log(key);
    // }
    // for (const key in arr) {
    //     console.log(key);
    // }
    for (const val of arr) {
        console.log(val);
    }
})
console.log('改变我的值');
// 原型链的问题
// const obj = {};
// const proto = {`
//     bar: 1
// }
// const child = reactive(obj);
// const parent = reactive(proto);
// Object.setPrototypeOf(child, parent)
// effect(() => {
//     console.log(child.bar);
// })
// child.bar = 2;
// // 数组
// arr[1] = 'arr2'
// arr.length = 0
// const obj = {};
// arr = reactive([obj]);
// console.log(arr.includes(obj));

// set 和 map
// const p = reactive(new Set([1, 2, 3]));
// console.log(p.size);
// console.log(p.delete(1));
// console.log(p.entries());
// const p = reactive(new Map([
//     [{
//         key: 1
//     }, {
//         value: 1
//     }]
// ]));
// effect(() => {
//     p.forEach(function (value, key) {
//         console.log(value, key);
//     })
// })

// p.set({
//     key: 2
// }, {
//     value: 2
// })

// 迭代器
const p = reactive(new Map([
    ['key1', 'value1'],
    ['key2', 'value2']
]))
effect(() => {
    // p.forEach(function (value, key) {
    //     console.log(value, key);
    // })
    // for (const key of p.values()) {
    //     console.log(key);
    // }
    for (const key of p.keys()) {
        console.log(key);
    }
})
p.set('key3', 'value3');
//  obj.car = 3; // 新添属性触发set
//  obj.foo = 3; // 修改已有属性
//  delete obj.foo // 删除属性