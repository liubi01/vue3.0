// 测试 Vue 3.0 响应式系统的实现
const { JSDOM } = require('jsdom');
const { window } = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = window;
global.document = window.document;

// 引入被测试代码
const { effect, obj } = require('./index3_完整的响应式系统.html');

describe('Vue 3.0 响应式系统', () => {
    beforeEach(() => {
        // 重置副作用函数
        activeEffect = null;
        // 重置数据
        obj.text = 'hello world';
    });

    test('effect 函数应正确注册副作用函数', () => {
        const mockFn = jest.fn();
        effect(mockFn);
        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('响应式数据应正确读取', () => {
        expect(obj.text).toBe('hello world');
    });

    test('响应式数据修改应触发副作用函数', () => {
        const mockFn = jest.fn(() => {
            console.log(obj.text);
        });
        effect(mockFn);
        obj.text = 'hello vue3';
        expect(mockFn).toHaveBeenCalledTimes(2);
    });

    test('未注册副作用函数时不应触发更新', () => {
        const mockFn = jest.fn();
        obj.text = 'hello vue3';
        expect(mockFn).not.toHaveBeenCalled();
    });

    test('新增属性不应触发副作用函数', () => {
        const mockFn = jest.fn();
        effect(mockFn);
        obj.newProperty = 'new value';
        expect(mockFn).toHaveBeenCalledTimes(1);
    });
});