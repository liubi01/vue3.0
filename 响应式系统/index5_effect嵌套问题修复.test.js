const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// 模拟浏览器环境
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;

// 加载被测试的代码
const htmlPath = path.join(__dirname, 'index5_effect嵌套问题修复.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
dom.window.eval(htmlContent);

// 获取全局变量
const { effect, obj, cleanup } = dom.window;

describe('响应式系统测试', () => {
    beforeEach(() => {
        // 重置数据
        obj.foo = true;
        obj.bar = true;
    });

    test('effect 基本功能测试', () => {
        const mockFn = jest.fn();
        effect(mockFn);
        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('响应式数据更新触发 effect', () => {
        const mockFn = jest.fn(() => {
            console.log(obj.foo);
        });
        effect(mockFn);
        obj.foo = false;
        expect(mockFn).toHaveBeenCalledTimes(2);
    });

    test('嵌套 effect 场景', () => {
        const outerFn = jest.fn(() => {
            effect(() => {
                console.log(obj.bar);
            });
        });
        effect(outerFn);
        obj.foo = false;
        expect(outerFn).toHaveBeenCalledTimes(2);
    });

    test('依赖清理机制', () => {
        const mockFn = jest.fn();
        effect(mockFn);
        cleanup(mockFn);
        obj.foo = false;
        expect(mockFn).toHaveBeenCalledTimes(1); // 清理后不应再触发
    });

    test('边界条件：多次触发同一数据', () => {
        const mockFn = jest.fn();
        effect(mockFn);
        obj.foo = false;
        obj.foo = true;
        obj.foo = false;
        expect(mockFn).toHaveBeenCalledTimes(4); // 初始 + 3 次更新
    });
});