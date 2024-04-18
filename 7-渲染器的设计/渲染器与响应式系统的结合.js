const vnode = {
    type: 'h1',
    children: 'hello'
}

function createRenderer(options) {
    const {
        createElement,
        insert,
        setElementText
    } = options;

    function patch(n1, n2, container) {
        if (!n1) {
            mountElement(n2, container);
        } else {
            // 打补丁
        }
    };

    function mountElement(vnode, container) {
        const el = createElement(vnode.type);
        if (typeof vnode.children === 'string') {
            setElementText(el, vnode.children);
        }
        insert(el, container);
    }

    function render(vnode, container) {
        if (vnode) {
            patch(container._vnode, vnode, container)
        } else {
            if (container._vnode) {
                container.innerHtml = ''
            }
        }
        container._vnode = vnode;
    }
    return {
        render
    }
}

const browserOptions = {
    createElement(tag) {
        return document.createElement(tag);
    },
    setElementText(el, text) {
        el.textContent = text;
    },
    insert(el, parent, anchor = null) {
        parent.insertBefore(el, anchor);
    }
};
const renderer = createRenderer(browserOptions)
renderer.render(vnode, document.getElementById('app'))

// 自定义渲染器
const printOption = {
    createElement(tag) {
        console.log(`创建元素${tag}`)
        return {
            tag
        }
    },
    setElementText(el, text) {
        console.log(`设置 ${JSON.stringify(el)} 的文本内容为： ${text}`)
        el.text = text
    },
    insert(el, parent, anchor) {
        console.log(`将 ${JSON.stringify(el)} 添加到 ${JSON.stringify(parent)} 下`)
        parent.children = el
    }
}
const rendererPrint = createRenderer(printOption)
// const container = {type: 'root'}
rendererPrint.render(vnode, {
    type: 'root'
})