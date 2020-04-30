'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const TypeDoc = require('typedoc');
const highlightJs = require('highlight.js');
const path = require('path');
const markdownIt = require('markdown-it');
const markdown = new markdownIt({
    html: true,
    typographer: true,
    highlight: function (str, lang) {
        if ((lang !== null && lang !== void 0 ? lang : 'typescript') && highlightJs.getLanguage(lang)) {
            try {
                return highlightJs.highlight(lang, str).value;
            }
            catch (err) {
                console.log(err);
            }
        }
        return '';
    },
});
function span(value, className) {
    if (!className)
        return value;
    return '<span class="' + className + '">' + value + '</span>';
}
function punct(value) {
    return '<span class="punct">' + value + '</span>';
}
function getReflectionByID(id, root = gNodes) {
    if (root.type !== 'reference' && root.id === id)
        return root;
    let result;
    root.children &&
        root.children.some((x) => {
            result = getReflectionByID(id, x);
            return result !== undefined;
        });
    return result;
}
function getReflectionsByName(name, root) {
    if (!root)
        root = gNodes;
    let result = [];
    if (root.name === name)
        result.push(root);
    if (root.children) {
        root.children.forEach((x) => {
            result = [...result, ...getReflectionsByName(name, x)];
        });
    }
    return result;
}
function getReflectionByName(name, root, kind) {
    let candidates = [];
    candidates = getReflectionsByName(name, root);
    if (candidates.length > 0) {
        candidates.sort((a, b) => b.kind - a.kind);
        if (typeof kind === 'number') {
            candidates = candidates.filter((x) => (x.kind & kind) !== 0);
        }
        else if (kind === 'static') {
            candidates = candidates.filter((x) => x.kind === 2048 && hasFlag(x, 'isStatic'));
        }
        else if (typeof kind === 'string') {
            const numKind = NUMERIC_KIND[kind];
            candidates = candidates.filter((x) => (x.kind & numKind) !== 0);
        }
        if (candidates.length > 0) {
            return candidates[0];
        }
    }
    return null;
}
const NUMERIC_KIND = {
    namespace: 2,
    enum: 4,
    variable: 32,
    function: 64,
    class: 128,
    interface: 256,
    instance: 1024 | 2048 | 262144,
    static: 1024 | 2048,
    type: 4194304,
};
function getNameSelector(segment) {
    const m = segment.match(/^\(([^\:]+)(\:([^\)]+))?\)$/);
    if (m) {
        return [m[1], m[3]];
    }
    return [segment, undefined];
}
function getReflectionByLink(link, root) {
    const segments = link.split('.');
    if (segments.length === 1) {
        const [name, kind] = getNameSelector(segments[0]);
        return (getReflectionByName(name, root, kind) ||
            getReflectionByName(name, getParent(root), kind) ||
            getReflectionByName(name, null, kind));
    }
    const lastSegment = segments.pop();
    let node = null;
    for (const segment of segments) {
        const [name, kind] = getNameSelector(segment);
        node = getReflectionByName(name, node, kind);
    }
    return getReflectionByLink(lastSegment, node);
}
function getAncestors(node, root = gNodes) {
    if (!node)
        return null;
    if (node.id === root.id)
        return [root];
    if (root.children) {
        for (const child of root.children) {
            let ancestors = getAncestors(node, child);
            if (ancestors) {
                return [...ancestors, root];
            }
        }
    }
    return null;
}
function getParent(node) {
    let ancestors = getAncestors(node);
    if (ancestors)
        return ancestors[1];
    return null;
}
function getChildrenByID(node, children) {
    return children.map((x) => node.children.filter((child) => child.id === x)[0]);
}
function getName(node) {
    if (node.kind === 1) {
        return getModuleName(node);
    }
    return node.name;
}
function everyStringLiteral(nodes) {
    return nodes.every((x) => x.type === 'stringLiteral');
}
function sortOtherCategoryAtEnd(categories) {
    return categories.sort((a, b) => {
        if (a.title === b.title)
            return 0;
        if (a.title === 'Other')
            return 1;
        if (b.title === 'Other')
            return -1;
        return a.title < b.title;
    });
}
const KIND_ORDER = {
    512: 1,
    64: 2,
    2048: 3,
    262144: 4,
    1024: 5,
    32: 6,
    256: 7,
    128: 8,
    4194304: 9,
    4: 10,
};
function sortGroups(groups) {
    return groups.sort((a, b) => {
        console.assert(KIND_ORDER[b.kind] && KIND_ORDER[a.kind]);
        return KIND_ORDER[a.kind] === KIND_ORDER[b.kind]
            ? 0
            : KIND_ORDER[a.kind] < KIND_ORDER[b.kind]
                ? -1
                : +1;
    });
}
function getCategories(node, kind) {
    let result = [];
    let children = node.groups && node.groups.filter((x) => x.kind === kind);
    if (!children || children.length !== 1) {
        if (node.categories) {
            return sortOtherCategoryAtEnd(node.categories);
        }
        return node.children.filter((x) => x.kind === kind);
    }
    if (children[0].categories) {
        result = children[0].categories.map((category) => {
            return {
                title: category.title,
                children: getChildrenByID(node, category.children),
            };
        });
        result = sortOtherCategoryAtEnd(result);
    }
    else {
        result = [
            {
                title: '',
                children: getChildrenByID(node, children[0].children),
            },
        ];
    }
    return result;
}
function makePermalink(node) {
    var _a;
    node = getReflectionByID(node.id);
    if (!node || node.kind === 0) {
        return { anchor: '', title: '' };
    }
    const parent = getParent(node);
    if (!parent) {
        return { anchor: '', title: (_a = node.name) !== null && _a !== void 0 ? _a : '' };
    }
    let result;
    if (node.kind === 512) {
        let grandparentPermalink = makePermalink(getParent(parent));
        if (grandparentPermalink) {
            result = {
                anchor: (grandparentPermalink.anchor
                    ? grandparentPermalink.anchor + '.'
                    : '') +
                    parent.name +
                    ':constructor',
                title: 'new ' + parent.name + '()',
            };
        }
        else {
            result = {
                anchor: parent.name + ':constructor',
                title: 'new ' + parent.name + '()',
            };
        }
    }
    else {
        const qualifiedSymbol = getQualifiedSymbol(parent, node);
        const parentPermalink = makePermalink(parent);
        let nodeName = getName(node);
        result = parentPermalink
            ? {
                anchor: (parentPermalink.anchor
                    ? parentPermalink.anchor + '.'
                    : '') + qualifiedSymbol,
                title: parentPermalink.title + '.' + nodeName,
            }
            : {
                anchor: qualifiedSymbol,
                title: nodeName,
            };
    }
    if (shouldIgnore(node)) {
        result.anchor = '';
    }
    return result;
}
function renderPermalink(permalink, title) {
    title = title || permalink.title;
    if (permalink.document && permalink.anchor) {
        return `<a href="${permalink.document}#${encodeURIComponent(permalink.anchor)}">${title}</a>`;
    }
    else if (permalink.document) {
        return `<a href="${permalink.document}}">${title}</a>`;
    }
    else if (permalink.anchor) {
        return `<a href="#${encodeURIComponent(permalink.anchor)}">${title}</a>`;
    }
    return title;
}
function renderPermalinkAnchor(permalink) {
    console.assert(!permalink.document);
    return ('<a class="permalink" href="#' +
        encodeURIComponent(permalink.anchor) +
        '" title="Permalink"><span class="sr-only"> Permalink </span>' +
        '<svg><use xlink:href="#link"></use></svg>' +
        '</a>');
}
function renderIndex(node, title, categories, options) {
    if (!categories || categories.length === 0)
        return '';
    let result = '';
    if (title) {
        result += '\n\n<h3>';
        result += '<em>' + getQualifiedName(node) + ' </em>';
        result += `${title}</h3>\n`;
    }
    if (categories.length === 1 && categories[0].children.length <= 1) {
        return result;
    }
    options = options || { symbolSuffix: '' };
    return (result +
        categories
            .map((category) => {
            let r = '';
            if (category.title) {
                r += `\n\n<h4>${category.title}</h4>\n`;
            }
            r += '\n<div class="index"><ul><li>';
            r += category.children
                .map((x) => {
                if (typeof x === 'number')
                    x = getReflectionByID(x);
                return renderPermalink(makePermalink(x), x.name + options.symbolSuffix);
            })
                .filter((x) => !!x)
                .join('</li>\n<li>');
            r += '</li></ul></div>\n';
            return r;
        })
            .join('\n'));
}
function hasFlag(node, flag) {
    return node && node.flags && node.flags[flag];
}
function getTag(node, tag) {
    if (node && node.comment && node.comment.tags) {
        let result = node.comment.tags.filter((x) => x.tag === tag);
        console.assert(result.length <= 1);
        if (result.length === 1) {
            return result[0].text || '';
        }
    }
    return '';
}
function hasTag(node, tag) {
    return (node &&
        node.comment &&
        node.comment.tags &&
        node.comment.tags.filter((x) => x.tag === tag).length > 0);
}
function renderFlags(node, style = 'block') {
    if (!node)
        return '';
    let result = '';
    if (node.flags) {
        if (node.flags.isAbstract)
            result += span('abstract', 'modifier-tag');
        if (node.flags.isPrivate)
            result += span('private', 'modifier-tag');
        if (node.flags.isProtected)
            result += span('protected', 'modifier-tag');
        if (node.flags.isPublic)
            result += span('public', 'modifier-tag');
        if (node.flags.isExternal)
            result += span('external', 'modifier-tag');
        if (node.flags.isStatic)
            result += span('static', 'modifier-tag');
    }
    const TAGS = {
        eventproperty: '',
        override: '',
        readonly: '',
        sealed: '',
        virtual: '',
        deprecated: 'red modifier-tag',
        beta: 'orange modifier-tag',
        alpha: 'orange modifier-tag',
        experimental: 'orange modifier-tag',
    };
    const TAG_NAME = {
        eventproperty: 'event',
        readonly: 'read only',
    };
    result += Object.keys(TAGS)
        .map((x) => hasTag(node, x) ? span(TAG_NAME[x] || x, TAGS[x]) : '')
        .join('');
    return result
        ? style === 'block'
            ? '<div class="flags">' + result + '</div>\n'
            : '<span class="flags">' + result + '</span>\n'
        : '';
}
function renderTag(node, tag, text) {
    if (!tag || !text)
        return '';
    let result = '';
    text = trimNewline(text.trim()) || '';
    switch (tag) {
        case 'method':
            result +=
                '<strong>Method:</strong> ' +
                    markdown.render(renderLinkTags(node, text));
            break;
        case 'module':
            result +=
                '<strong>Module:</strong> ' +
                    markdown.render(renderLinkTags(node, text));
            break;
        case 'function':
            result +=
                '<strong>Function:</strong> ' +
                    markdown.render(renderLinkTags(node, text));
            break;
        case 'example':
            result +=
                '\n<pre><code>' +
                    highlightJs.highlight('typescript', text).value +
                    '</pre></code>\n';
            break;
        case 'typedef':
        case 'type':
        case 'property':
        case 'param':
        case 'returns':
            break;
        case 'privateremarks':
            break;
        case 'packagedocumentation':
            break;
        case 'category':
            break;
        case 'global':
            break;
        case 'command':
            break;
        default:
            if (text) {
                const noticeStyle = {
                    eventproperty: 'info',
                    override: 'info',
                    public: 'info',
                    readonly: 'info',
                    sealed: 'info',
                    virtual: 'info',
                    alpha: 'warning',
                    beta: 'warning',
                    experimental: 'warning',
                    deprecated: 'danger',
                    internal: 'danger',
                }[tag] || 'info';
                const tagLabel = { eventproperty: 'event' }[tag] || tag;
                result += '<section class="notice--' + noticeStyle + '">\n';
                result +=
                    '<h4>' +
                        tagLabel +
                        '</h4>\n\n' +
                        markdown.render(renderLinkTags(node, text));
                result += '\n</section>';
            }
            else if (!/alpha|beta|deprecated|eventproperty|experimental|internal|override|public|readonly|sealed|virtual/i.test(tag)) {
                result += '<strong>' + tag + '</strong>';
            }
    }
    return result;
}
function escapeYAMLString(str) {
    return str.replace(/([^\\])'/g, "$1\\'");
}
function trimQuotes(str) {
    return str.replace(/(^")|("$)/g, '');
}
function trimNewline(str) {
    return str.replace(/(\n+)$/g, '');
}
function getQualifiedSymbol(parent, node) {
    if (node.kind === 0) {
        return '';
    }
    if (node.kind === 1) {
        console.assert(parent.kind === 0);
        if (parent.children.length === 1) {
            return '';
        }
        else {
            return '("' + getModuleName(node) + '":module)';
        }
    }
    if (node.kind === 2) {
        if (/^"(.*)"$/.test(node.name)) {
            return '("' + trimQuotes(node.name) + '":module)';
        }
        return '(' + node.name + '":namespace)';
    }
    if (node.type === 'reference') {
        node = getReflectionByID(node.id);
    }
    const symbol = node.name;
    let selector = {
        2: 'namespace',
        4: 'enum',
        32: 'variable',
        16: '',
        64: 'function',
        128: 'class',
        256: 'interface',
        1024: '',
        2048: '',
        4096: 'function',
        262144: 'instance',
        4194304: 'type',
    }[node.kind];
    console.assert(typeof selector !== 'undefined');
    if (node.kind === 512) {
        return ':constructor';
    }
    if (parent && parent.kind === 128) {
        if (node.kind === 1024 || node.kind === 2048) {
            if (node.flags && node.flags.isStatic) {
                selector = 'static';
            }
            else {
                selector = 'instance';
            }
        }
    }
    else if (parent && parent.kind === 256) {
        selector = '';
    }
    const label = getTag(node, 'label');
    if (label) {
        selector = label;
    }
    return selector ? `(${symbol}:${selector})` : symbol;
}
function getQualifiedName(node) {
    if (!node || node.kind === 0)
        return '';
    if (node.kind === 256) {
        return (span('interface ', 'keyword') +
            '<strong>' +
            getName(node) +
            '</strong>');
    }
    if (node.kind === 128) {
        if (hasFlag(node, 'isAbstract')) {
            return (span('abstract class ', 'keyword') +
                '<strong>' +
                getName(node) +
                '</strong>');
        }
        return (span('class ', 'keyword') + '<strong>' + getName(node) + '</strong>');
    }
    if (node.kind === 4) {
        return (span('enum ', 'keyword') + '<strong>' + getName(node) + '</strong>');
    }
    if (node.kind === 2) {
        if (/^"(.*)"$/.test(node.name)) {
            return (span('module ', 'keyword') +
                '<strong>' +
                trimQuotes(node.name) +
                '</strong>');
        }
        return (span('namespace ', 'keyword') +
            '<strong>' +
            getName(node) +
            '</strong>');
    }
    if (node.kind === 1) {
        return (span('module ', 'keyword') +
            '<strong>' +
            '"' +
            getName(node) +
            '"' +
            '</strong>');
    }
}
function resolveLink(node, link) {
    if (/^http[s]?:\/\//.test(link)) {
        return link;
    }
    if (!getReflectionByLink(link, node)) {
        console.warn('Unresolved link : ', link);
    }
    let result = '';
    const imports = link.split('#');
    if (imports.length > 1) {
        result = imports[0];
        link = imports.slice(1).join('');
    }
    const linkSegments = link.split('.');
    let root = gNodes;
    linkSegments.forEach((linkSegment) => {
        root = getReflectionByLink(linkSegment, root);
    });
    return root
        ? result + '#' + encodeURIComponent(makePermalink(root).anchor)
        : result + '#' + linkSegments.join('.');
}
function renderLinkTags(node, str) {
    str = str.replace(/{@tutorial\s+(\S+?)[ \|]+(.+?)}/g, (_match, p1, p2) => `<a href="${p1}">${p2}</a>`);
    str = str.replace(/{@tutorial\s+(\S+?)}/g, (_match, p1) => `<a href="${p1}">${p1}</a>`);
    str = str.replace(/{@linkcode\s+(\S+?)\s*\|\s*(.+?)}/g, (_match, p1, p2) => `<a href="${resolveLink(node, p1)}"><code>${p2}</code></a>`);
    str = str.replace(/{@linkcode\s+(\S+?)}/g, (_match, p1) => `<a href="${resolveLink(node, p1)}"><code>${p1}</code></a>`);
    str = str.replace(/\[\[\`(\S+?)\`\s*\|\s*(.+?)\]\]/g, (_match, p1) => `<a href="${resolveLink(node, p1)}"><code>${p1}</code></a>`);
    str = str.replace(/\[\[\`(\S+?)\`\]\]/g, (_match, p1) => `<a href="${resolveLink(node, p1)}"><code>${p1}</code></a>`);
    str = str.replace(/{@(?:link|linkplain)\s+(\S+?)}/g, (_match, p1) => `<a href="${resolveLink(node, p1)}">${p1}</a>`);
    str = str.replace(/{@(?:link|linkplain)\s+(\S+?)\s*\|\s*(.+?)}/g, (_match, p1, p2) => `<a href="${resolveLink(node, p1)}">${p2}</a>`);
    str = str.replace(/\[\[(\S+?)\]\]/g, (_match, p1) => `<a href="${resolveLink(node, p1)}">${p1}</a>`);
    str = str.replace(/\[\[(\S+?)\s*\|\s*(.+?)\]\]/g, (_match, p1, p2) => `<a href="${resolveLink(node, p1)}">${p2}</a>`);
    str = str.replace(/({@(?:inheritDoc)\s+(\S+?)})/gi, (_match, p1, p2) => {
        if (!p1.startsWith('{@inheritDoc')) {
            console.warn('Check capitalization of @inheritDoc', p1);
        }
        let node = getReflectionByLink(p2);
        if (!node) {
            console.warn('Unresolved link in @inheritDoc :', p2);
            return p1;
        }
        return render(node, 'block-inherit');
    });
    return str;
}
function renderNotices(node, str) {
    const lines = str.split('\n');
    const blocks = [];
    let inShortBlock = false;
    let inLongBlock = false;
    let currentBlock = [];
    let currentType = '';
    lines.forEach((line) => {
        if (inShortBlock) {
            let m = line.match(/^\s*$/i);
            if (m) {
                if (currentBlock.length > 0) {
                    blocks.push({
                        type: currentType,
                        content: currentBlock.join('\n'),
                    });
                }
                inShortBlock = false;
                currentType = '';
                currentBlock = [];
            }
            else {
                currentBlock.push(line);
            }
        }
        else if (inLongBlock) {
            if (/^[ ]{0,3}(\*\*\*|---)/.test(line)) {
                if (currentBlock.length > 0) {
                    blocks.push({
                        type: currentType,
                        content: currentBlock.join('\n'),
                    });
                }
                inLongBlock = false;
                currentType = '';
                currentBlock = [];
            }
            else {
                currentBlock.push(line);
            }
        }
        else {
            let m = line.match(/\n*\*\*\(([^]+)\):?\s*\*\*\s*:?\s*([^]+)/i);
            if (m) {
                if (currentBlock.length > 0) {
                    blocks.push({
                        type: currentType,
                        content: currentBlock.join('\n'),
                    });
                }
                inShortBlock = true;
                currentType = m[1];
                currentBlock = [m[2]];
            }
            else {
                m = line.match(/\n*\*\*\(([^]+)\):?\s*\*\*\s*:?\s*$/i);
                if (m) {
                    if (currentBlock.length > 0) {
                        blocks.push({
                            type: currentType,
                            content: currentBlock.join('\n'),
                        });
                    }
                    inLongBlock = true;
                    currentType = m[1];
                    currentBlock = [];
                }
                else {
                    currentBlock.push(line);
                }
            }
        }
    });
    if (currentBlock.length > 0) {
        blocks.push({ type: currentType, content: currentBlock.join('\n') });
    }
    return blocks
        .map((block) => {
        if (block.type) {
            let noticeType = {
                danger: 'danger',
                warning: 'warning',
                caution: 'warning',
            }[block.type.toLowerCase()] || 'info';
            let result = '\n<div class="notice--' + noticeType + '">';
            result += '\n<h4>' + block.type + '</h4>\n';
            result += markdown.render(renderLinkTags(node, block.content));
            result += '\n</div>\n';
            return result;
        }
        return markdown.render(renderLinkTags(node, block.content));
    })
        .join('\n');
}
function renderComment(node, style) {
    if (!node)
        return '';
    if (node.signatures && !node.comment)
        return renderComment(node.signatures[0], style);
    if (!node.comment)
        return '';
    let result = '';
    let newLine = '\n';
    if (node.comment.shortText) {
        result += renderNotices(node, node.comment.shortText) + newLine;
    }
    if (node.comment.text) {
        result += renderNotices(node, node.comment.text) + newLine;
    }
    const remarks = getTag(node.comment, 'remarks');
    if (remarks) {
        result += renderNotices(node, remarks) + newLine;
    }
    if (style !== 'block-inherit') {
        if (node.comment.tags && node.comment.tags.length > 0) {
            result +=
                newLine +
                    node.comment.tags
                        .map((x) => renderTag(node, x.tag, x.text))
                        .filter((x) => !!x)
                        .join(newLine + newLine) +
                    newLine;
        }
    }
    return result;
}
function getModuleName(node) {
    if (!node)
        return '';
    if (node.kind === 1) {
        return trimQuotes(node.name).replace(/\.d$/, '');
    }
    return getModuleName(getParent(node));
}
function shouldIgnore(node) {
    return (hasTag(node, 'hidden') ||
        hasTag(node, 'ignore') ||
        hasTag(node, 'internal'));
}
function renderCardHeader(node, displayName) {
    const parent = getParent(node);
    if (!displayName) {
        displayName = `<strong>${getName(node)}</strong>`;
        if (node.kind === 4 ||
            node.kind === 32 ||
            node.kind === 64 ||
            node.kind === 128 ||
            node.kind === 256 ||
            node.kind === 1024 ||
            node.kind === 2048) {
            if (parent &&
                (parent.kind === 1 || parent.kind === 2 || parent.kind === 256)) {
                displayName = getName(parent) + '.' + displayName;
            }
        }
    }
    const permalink = makePermalink(node);
    let result = `\n<section class="card" id="${encodeURIComponent(permalink.anchor)}">\n`;
    console.assert(!permalink.document);
    result += `\n<h3 `;
    if (hasTag(node, 'deprecated'))
        result += 'class="deprecated" ';
    result += '>';
    result += renderFlags(node);
    result += '<span>' + displayName + '</span>';
    result += renderPermalinkAnchor(permalink);
    result += '</h3>';
    return result;
}
function renderCardFooter(node) {
    return renderComment(node, 'card') + '\n</section>\n';
}
function renderMethodCard(node) {
    if (shouldIgnore(node))
        return '';
    let result = renderCommandCard(node);
    if (result)
        return result;
    const parent = getParent(node);
    let displayName = '';
    let shortName = '';
    if (node.kind === 512) {
        displayName =
            span('new ', 'keyword') + `<strong>${parent.name}</strong>`;
        shortName = displayName;
    }
    else if (parent && parent.kind === 1) {
        shortName = `<strong>${node.name}</strong>`;
        displayName = `<em>module ${parent.name} </em>` + shortName;
    }
    else if (parent && (parent.kind & (2 | 4 | 128 | 256)) !== 0) {
        shortName = `<strong>${node.name}</strong>`;
        if (parent.kind === 2 && /^"(.*)"$/.test(parent.name)) {
            displayName =
                `<em>module ${trimQuotes(parent.name)} </em>` + shortName;
        }
        else {
            displayName = parent.name + '.' + shortName;
        }
    }
    else {
        shortName = `<strong>${node.name}</strong>`;
        displayName = shortName;
    }
    result = renderCardHeader(node, displayName);
    result += '\n<div>\n';
    result += node.signatures
        .map((signature) => {
        let result = '\n<div>\n';
        result += renderFlags(signature);
        result += '\n<div><code>\n';
        result += shortName;
        result += render(signature, 'inline');
        result += '\n</code></div>\n';
        result += render(signature, 'block');
        result += '\n<div>\n';
        return result;
    })
        .join('\n<hr>\n');
    return result + '\n</div>\n' + renderCardFooter(node);
}
function renderAccessorCard(node) {
    if (shouldIgnore(node))
        return '';
    let displayName = '';
    if (node.getSignature && node.setSignature) {
        displayName =
            span('get/set ', 'keyword') + `<strong>${node.name}</strong>`;
    }
    else if (node.getSignature) {
        displayName = span('get ', 'keyword') + `<strong>${node.name}</strong>`;
    }
    else {
        displayName = span('set ', 'keyword') + `<strong>${node.name}</strong>`;
    }
    let result = renderCardHeader(node, displayName);
    result += '\n<div>\n';
    const type = node.getSignature
        ? node.getSignature[0].type
        : node.setSignature[0].type;
    result += '\n<div>\n';
    result += '\n<div>';
    result += '<code>\n';
    result += node.name;
    result += punct(': ');
    result += render(type, 'inline');
    result += '\n</code>';
    if (node.getSignature && !node.setSignature) {
        result += span('read only', 'modifier-tag');
    }
    else if (!node.getSignature && node.setSignature) {
        result += span('write only', 'modifier-tag');
    }
    result += '</div>\n';
    result += '\n<div>\n';
    return result + '\n</div>\n' + renderCardFooter(node);
}
function renderClassSection(node) {
    if (shouldIgnore(node) || !node.children)
        return '';
    if (node.groups.length === 1 &&
        (node.groups[0].kind & (1024 | 2048)) !== 0 &&
        !hasTag(node, 'command')) {
        return render(node, 'card');
    }
    const permalink = makePermalink(node);
    let result = `<section id="${encodeURIComponent(permalink.anchor)}">`;
    result += '<h2';
    if (hasTag(node, 'deprecated'))
        result += ' class="deprecated"';
    result += '>';
    const parent = getParent(node);
    if (parent) {
        result += '<em>' + getQualifiedName(parent) + ' </em>';
    }
    result += '<span>' + getQualifiedName(node) + '</span>';
    result += renderPermalinkAnchor(permalink);
    result += '</h2>';
    result += renderFlags(node);
    result += '<div>';
    if (node.extendedTypes) {
        result +=
            '<p>' +
                span('Extends:', 'tag-name') +
                node.extendedTypes
                    .map((x) => render(x))
                    .filter((x) => !!x)
                    .join(', ') +
                '</p>';
    }
    if (node.implementedTypes) {
        result +=
            '<p>' +
                span('Implements:', 'tag-name') +
                node.implementedTypes
                    .map((x) => render(x))
                    .filter((x) => !!x)
                    .join(', ') +
                '</p>';
    }
    if (node.extendedBy) {
        result +=
            '<p>' +
                span('Extended by:', 'tag-name') +
                node.extendedBy
                    .map((x) => render(x))
                    .filter((x) => !!x)
                    .join(', ') +
                '</p>';
    }
    if (node.implementedBy) {
        result +=
            '<p>' +
                span('Implemented by:', 'tag-name') +
                node.implementedBy
                    .map((x) => render(x))
                    .filter((x) => !!x)
                    .join(', ') +
                '</p>';
    }
    result += '</div>';
    return result + renderGroups(node) + '</section>';
}
function renderClassCard(node) {
    if (shouldIgnore(node) || !node.children)
        return '';
    let result = renderCardHeader(node, getQualifiedName(node));
    result += '<dl><dt id="';
    result += node.children
        .map((x) => {
        let permalink = makePermalink(x);
        let r = encodeURIComponent(permalink.anchor) + '"><code>';
        if (x.kind === 2048) {
            r +=
                x.signatures
                    .map((signature) => {
                    let sigResult = renderFlags(x, 'inline') +
                        '<strong>' +
                        x.name +
                        '</strong>';
                    if (hasFlag(x, 'isOptional')) {
                        sigResult += span('?', 'modifier');
                    }
                    sigResult +=
                        renderPermalinkAnchor(permalink) +
                            render(signature) +
                            '</code></dt><dd>' +
                            renderComment(signature, 'card');
                    return sigResult;
                })
                    .join('</dd><dt><cade>') + '</dd>';
        }
        else if (x.kind === 1024) {
            r += '<strong>' + x.name + '</strong>';
            if (hasFlag(x, 'isOptional')) {
                r += span('?', 'modifier');
            }
            r +=
                punct(': ') +
                    render(x.type) +
                    renderPermalinkAnchor(permalink) +
                    '</code></dt><dd>' +
                    renderComment(x, 'card');
        }
        else {
            console.error('Unexpected item in a "short" class/interface');
        }
        return r;
    })
        .join('\n</dd><dt id="');
    result += '\n</dd></dl>\n';
    return result + renderCardFooter(node);
}
function renderCommandCard(node) {
    let parent = getParent(node);
    let commandTag = (getTag(node, 'command') || getTag(parent, 'command')).trim();
    if (!commandTag)
        return '';
    let signature;
    if (node.kind === 1024) {
        if (!node.type.declaration)
            return '';
        signature = node.type.declaration.signatures[0];
    }
    else if (node.kind === 2048) {
        signature = node.signatures[0];
    }
    else {
        return '';
    }
    let params = [...signature.parameters];
    let result = renderCardHeader(node, '<span class="modifier-tag">command</span><strong>' +
        node.name +
        '</strong>');
    result += '<div>';
    result += '<code>' + commandTag + punct('(');
    params.shift();
    if (params.length > 0) {
        result += punct('[');
        result += span('"' + node.name + '"', 'stringLiteral');
        result += punct(', ');
        result += params.map((x) => render(x)).join(punct(', '));
        result += punct(']');
    }
    else {
        result += span('"' + node.name + '"', 'stringLiteral');
    }
    result += punct(')');
    if (signature.type) {
        result += punct(': ');
        result += render(signature.type);
    }
    result += '</code>';
    if (params.length > 0 || signature.type) {
        result += '\n<dl>\n';
        if (params.length > 0) {
            result +=
                '\n<dt><code>\n' +
                    params
                        .map((param) => {
                        let r = '<strong><var>' + param.name + '</var></strong>';
                        const typeDef = render(param.type, 'block');
                        if (typeDef) {
                            r += punct(': ') + typeDef;
                        }
                        r += '\n</code></dt><dd>\n';
                        r += renderComment(param, 'card');
                        return r;
                    })
                        .join('\n</dd><dt><code>\n');
            result += '\n</dd>\n';
        }
        if (signature.type && hasTag(node, 'returns')) {
            result += '\n<dt><code>\n';
            result += '<strong>→ </strong>' + render(signature.type);
            result += '\n</code></dt><dd>\n';
            if (hasTag(node, 'returns')) {
                result += renderNotices(node, getTag(node, 'returns'));
            }
            result += '\n</dd>\n';
        }
        result += '\n</dl>\n';
    }
    result += '\n</div>';
    return result + renderCardFooter(node);
}
function renderPropertyCard(node) {
    if (shouldIgnore(node))
        return '';
    let result = renderCommandCard(node);
    if (result)
        return result;
    const parent = getParent(node);
    let displayName = '';
    let shortName = '';
    if (parent && (parent.kind & (1 | 2 | 4 | 128 | 256)) !== 0) {
        shortName = `<strong>${node.name}</strong>`;
        displayName = parent.name + '.' + shortName;
    }
    return (renderCardHeader(node, displayName) +
        render(node.type, 'block') +
        renderCardFooter(node));
}
function renderEnumCard(node) {
    if (shouldIgnore(node))
        return '';
    let result = renderCardHeader(node);
    if (node.children) {
        result += '<dl>';
        result += node.children
            .map((enumMember) => {
            return render(enumMember, 'block');
        })
            .join('');
        result += '</dl>';
    }
    return result + renderCardFooter(node);
}
function renderTypeAliasCard(node) {
    if (shouldIgnore(node))
        return '';
    let result = renderCardHeader(node);
    const typeDef = render(node, 'block');
    if (typeDef) {
        result += '\n<div>\n';
        result += typeDef;
        result += '\n</div>\n';
        result += '\n\n';
    }
    result += renderCardFooter(node);
    return result;
}
function renderGroup(node, group) {
    const topics = getCategories(node, group.kind);
    if (topics.length === 0)
        return '';
    let header = '';
    if (group.title !== 'Constructors' &&
        group.title !== 'Accessors' &&
        group.title !== 'Namespaces') {
        if ((group.kind === 1024 || group.kind === 2048) &&
            hasTag(node, 'command')) {
            header += renderIndex(node, '', topics);
        }
        else if (!((group.kind & (1 | 2 | 4 | 128 | 256)) !== 0) &&
            group.children <= 1) {
            const displayTitle = { 'Type aliases': 'Types' }[group.title] || group.title;
            header += renderIndex(node, displayTitle, topics);
        }
    }
    const body = topics
        .map((topic) => {
        let r = '';
        if (topic.title) {
            r += '<h3 class="category-title">';
            r += topic.title + '</h3>\n';
        }
        r += topic.children.map((x) => render(x, 'section')).join('');
        return r;
    })
        .join('');
    if (!body)
        return '';
    return '<section>' + header + body + '</section>';
}
function renderGroups(node) {
    if (!node.groups)
        return '';
    let groups = sortGroups(node.groups);
    return (renderComment(node, 'section') +
        groups
            .map((x) => renderGroup(node, x))
            .filter((x) => !!x)
            .join('\n\n'));
}
function render(node, style = 'inline') {
    if (typeof node === 'undefined')
        return '';
    if (typeof node === 'number')
        node = getReflectionByID(node);
    if (typeof node === 'string')
        node = getReflectionByName(node);
    if (style === 'section' && node.groups) {
        if (node.kind === 128 || node.kind === 256) {
            return renderClassSection(node);
        }
        else if (node.kind === 4) {
            return renderEnumCard(node);
        }
        return renderGroups(node);
    }
    let parent = getParent(node);
    if (node.type === 'abstract') {
        console.error('Unexpected node type ', node.type);
    }
    if (node.type === 'array') {
        return render(node.elementType, 'inline') + punct('[]');
    }
    if (node.type === 'conditionals') {
        console.error('Unexpected node type ', node.type);
    }
    if (node.type === 'index') {
        console.error('Unexpected node type ', node.type);
    }
    if (node.type === 'indexedAccess') {
        return (render(node.objectType) +
            punct('[') +
            render(node.indexType) +
            punct(']'));
    }
    if (node.type === 'inferred') {
        console.error('Unexpected node type ', node.type);
    }
    if (node.type === 'intersection') {
        if (style === 'block') {
            return ('<ul class="type-block"><li>' +
                node.types
                    .map((x) => render(x))
                    .filter((x) => !!x)
                    .join(punct(' &amp; ') + '</li>\n<li>') +
                '</li></ul>');
        }
        return node.types
            .map((x) => render(x))
            .filter((x) => !!x)
            .join(punct(' &amp; '));
    }
    if (node.type === 'intrinsic') {
        return span(node.name, 'keyword');
    }
    if (node.type === 'predicate') {
        console.error('Unexpected node type ', node.type);
    }
    if (node.type === 'reference') {
        let typeArguments = '';
        if (node.typeArguments) {
            typeArguments =
                punct('&lt;') +
                    node.typeArguments.map((x) => render(x)).join(punct(', ')) +
                    punct('&gt;');
        }
        let candidate;
        if (typeof node.id !== 'undefined') {
            candidate = getReflectionByID(node.id);
        }
        if (!candidate) {
            candidate = getReflectionByName(node.name, parent, 4 | 128 | 256 | 4194304);
        }
        if (candidate) {
            const permalink = makePermalink(candidate);
            if (candidate.kind === 16) {
                permalink.title = parent.name + '.' + node.name;
            }
            else {
                permalink.title = node.name;
            }
            return renderPermalink(permalink) + typeArguments;
        }
        candidate = getReflectionByName(node.name, undefined, 4 | 128 | 256 | 4194304);
        if (candidate) {
            return (renderPermalink(makePermalink(candidate), node.name) +
                typeArguments);
        }
        if (candidate) {
            return node.name + typeArguments;
        }
        if ([
            'Object',
            'Function',
            'Boolean',
            'Symbol',
            'String',
            'RegExp',
            'Object',
            'Number',
            'BigInt',
            'Math',
            'Date',
            'Infinity',
            'NaN',
            'globalThis',
            'Error',
            'AggregateError',
            'InternalError',
            'RangeError',
            'ReferenceError',
            'SyntaxError',
            'TypeError',
            'URIError',
            'Array',
            'Int8Array',
            'Uint8Array',
            'Uint8Array',
            'Uint8ClampedArray',
            'Int16Array',
            'Uint16Array',
            'Int32Array',
            'Uint32Array',
            'Float32Array',
            'Float64Array',
            'BigInt64Array',
            'BigUint64Array',
            'Map',
            'Set',
            'WeakMap',
            'WeakSet',
            'ArrayBuffer',
            'SharedArrayBuffer',
            'Atomics',
            'DataView',
            'JSON',
            'Promise',
            'Generator',
            'GeneratorFunction',
            'AsyncFunction',
            'Iterator',
            'AsyncIterator',
            'Reflect',
            'Proxy',
            'Intl',
            'WebAssembly',
        ].includes(node.name)) {
            return ('<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/' +
                node.name +
                '" class="externallink">' +
                node.name +
                '<svg><use xlink:href="#external-link"></use></svg>' +
                '</a>' +
                typeArguments);
        }
        return ('<a href="https://developer.mozilla.org/Web/API/' +
            node.name +
            '" class="externallink">' +
            node.name +
            '<svg><use xlink:href="#external-link"></use></svg>' +
            '</a>' +
            typeArguments);
    }
    if (node.type === 'reflection') {
        return render(node.declaration, style);
    }
    if (node.type === 'stringLiteral') {
        return span('"' + node.value + '"', 'stringLiteral');
    }
    if (node.type === 'tuple') {
        return (punct('[') +
            node.elements
                .map((x) => render(x))
                .filter((x) => !!x)
                .join(punct(', ')) +
            punct(']'));
    }
    if (node.type === 'typeOperator') {
        return span(node.operator + ' ', 'keyword') + render(node.target);
    }
    if (node.type === 'typeParameter') {
        let result = renderPermalink(makePermalink(node));
        if (node.constraint) {
            result += span(' extends ', 'keyword');
            result += render(node.constraint);
        }
        return result;
    }
    if (node.type === 'union') {
        if (style === 'block' && !everyStringLiteral(node.types)) {
            return ('<ul class="type-block"><li>' +
                punct('| ') +
                node.types
                    .map((x) => render(x))
                    .join('</li>\n<li>' + punct('| ')) +
                '</li></ul>');
        }
        else {
            return node.types.map((x) => render(x)).join(punct(' | '));
        }
    }
    if (node.type === 'unknown') {
        return '';
    }
    if (node.type === 'void') {
        return span('void', 'keyword');
    }
    let result = '';
    switch (node.kind) {
        case 0:
        case 1:
        case 2:
        case 4:
            console.assert('Unexpected node kind ', node.kind);
            break;
        case 16:
            result = `<dt id="${encodeURIComponent(makePermalink(node).anchor)}">`;
            result += '<strong>' + node.name + '</strong>';
            if (typeof node.defaultValue === 'string') {
                result += punct(' = ') + node.defaultValue;
            }
            result += '</dt><dd>';
            result += renderFlags(node);
            result += renderComment(node, style);
            result += '</dd>';
            break;
        case 32:
            if (style === 'card' || style === 'section') {
                result = renderCardHeader(node);
                result += '<div>' + render(node, 'block') + '</div>';
                result += renderCardFooter(node);
            }
            else {
                result += '<strong>' + node.name + '</strong>';
                if (hasFlag(node, 'isOptional')) {
                    result += span('?', 'modifier');
                }
                if (node.type && node.type.type === 'unknown') {
                    result += punct(' = ');
                    result += node.type.name || '';
                }
                if (node.type && node.type.type !== 'unknown') {
                    result += punct(': ');
                    result += render(node.type);
                }
            }
            break;
        case 64:
            if (style === 'card' || style === 'section') {
                result = renderMethodCard(node);
            }
            else {
                console.warn('Unexpected style, kind ', node.kind);
            }
            break;
        case 128:
            if (style === 'card' || style === 'section') {
                result = renderClassCard(node);
            }
            else {
                result = node.name;
            }
            break;
        case 256:
            if (style === 'card' || style === 'section') {
                result = renderClassCard(node);
            }
            else {
                result = node.name;
            }
            break;
        case 512:
            if (style === 'card' || style === 'section') {
                result = renderMethodCard(node);
            }
            else {
                console.warn('Unexpected style, kind ', node.kind);
            }
            break;
        case 1024:
            if (style === 'card' || style === 'section') {
                result = renderPropertyCard(node);
            }
            else {
                result =
                    (parent ? parent.name + '.' : '') +
                        node.name +
                        punct(': ') +
                        render(node.type, style);
            }
            break;
        case 2048:
            if (style === 'card' || style === 'section') {
                result = renderMethodCard(node);
            }
            else {
                console.error('Function Signature style not supported');
            }
            break;
        case 4096:
        case 16384:
            if (style === 'inline') {
                result = punct('(');
                if (node.parameters) {
                    result += node.parameters
                        .map((x) => render(x))
                        .join(punct(', '));
                }
                result += punct(')');
                result += punct(': ') + render(node.type);
            }
            else if (style === 'block') {
                if (node.parameters || node.type) {
                    result += '\n<dl>\n';
                    if (node.parameters) {
                        result +=
                            '\n<dt><code>\n' +
                                node.parameters
                                    .map((param) => {
                                    let r = '<strong><var>' +
                                        param.name +
                                        '</var></strong>';
                                    const typeDef = render(param.type, 'block');
                                    if (typeDef) {
                                        r += punct(': ') + typeDef;
                                    }
                                    r += '\n</code></dt><dd>\n';
                                    r += renderComment(param, style);
                                    return r;
                                })
                                    .join('\n</dd><dt><code>\n');
                        result += '\n</dd>\n';
                    }
                    if (node.type) {
                        result += '\n<dt><code>\n';
                        result += '<strong>→ </strong>' + render(node.type);
                        result += '\n</code></dt><dd>\n';
                        if (node.comment && node.comment.returns) {
                            result += renderNotices(node, node.comment.returns);
                        }
                        result += '\n</dd>\n';
                    }
                    result += '\n</dl>\n';
                }
            }
            else {
                console.error('Call signature style not supported');
            }
            break;
        case 8192:
            result +=
                punct('[') +
                    node.parameters.map((x) => render(x)).join(punct(', ')) +
                    punct(']');
            result += punct(': ') + render(node.type);
            break;
        case 32768:
            if (hasFlag(node, 'isRest')) {
                result += span('...', 'modifier');
            }
            result += `<var>${node.name}</var>`;
            if (hasFlag(node, 'isOptional')) {
                result += span('?', 'modifier');
            }
            result += punct(': ') + render(node.type);
            break;
        case 65536:
            if (node.signatures) {
                result += node.signatures
                    .map((x) => render(x))
                    .join(punct('; '));
            }
            else if (node.children || node.indexSignature) {
                if (style === 'block' || style === 'block-inherit') {
                    result += '<div><dl class="inset">';
                    if (node.children) {
                        result +=
                            '<dt><code>' +
                                node.children
                                    .map((x) => {
                                    let dt = render(x) + punct(';');
                                    if (hasTag(x, 'deprecated')) {
                                        dt = span(dt, 'deprecated');
                                    }
                                    const dd = renderFlags(x) +
                                        renderComment(x, style);
                                    return dt + '</code></dt><dd>' + dd;
                                })
                                    .join('</dd><dt><code>');
                        result += '</dd>';
                    }
                    if (node.indexSignature) {
                        result += '<dt><code>';
                        result += node.indexSignature
                            .map((x) => render(x))
                            .join(punct(';') + '</code></dt><dd>');
                        result += '</dd>';
                    }
                    result += '</dl>' + '</div>';
                }
                else if (style === 'inline') {
                    result += punct('{');
                    if (node.children) {
                        result += node.children
                            .map((x) => render(x))
                            .join(punct('; '));
                    }
                    if (node.indexSignature) {
                        result += node.indexSignature
                            .map((x) => render(x))
                            .join(punct('; '));
                    }
                    result += punct('}');
                }
                else {
                    console.error('Unexpected style for Type Literal');
                }
            }
            break;
        case 131072:
            result += node.name;
            if (node.type) {
                result += span(' extends ', 'keyword');
                result += render(node.type);
            }
            break;
        case 524288:
        case 1048576:
            console.warn('Unexpected kind ', node.kind);
            break;
        case 262144:
            if (style === 'card' || style === 'section') {
                result = renderAccessorCard(node);
            }
            else {
                console.warn('Unexpected style, kind ', node.kind);
            }
            break;
        case 2097152:
            console.warn('Unexpected style, kind ', node.kind);
            break;
        case 4194304:
            if (style === 'card' || style === 'section') {
                result = renderTypeAliasCard(node);
            }
            else {
                let def = render(node.type, style);
                result = '';
                if (node.typeParameter) {
                    result += punct('&lt;');
                    result += node.typeParameter
                        .map((typeParam) => render(typeParam))
                        .join(punct(', '));
                    result += punct('&gt;');
                    if (def) {
                        result += punct(' = ');
                    }
                }
                if (def && node.type === 'reference') {
                    result += renderPermalink(makePermalink(node.type)) + def;
                }
                else if (def) {
                    result += def;
                }
            }
            break;
        case 8388608:
            console.warn('Unexpected style, kind ', node.kind);
            break;
        default:
            console.warn('Unexpected kind ', node.kind);
    }
    return result;
}
let gNodes = {};
function getReflectionsFromFile(src) {
    src = src.map((x) => path.resolve(path.normalize(x)));
    let result = {};
    const app = new TypeDoc.Application();
    app.options.addReader(new TypeDoc.TypeDocReader());
    app.bootstrap({
        logger: (message, _level, _newline) => console.log(message),
        mode: 'file',
        target: 'es2017',
        module: 'ESNext',
        experimentalDecorators: true,
        moduleResolution: 'node',
        stripInternal: false,
        includeDeclarations: true,
        excludeExternals: true,
    });
    const convertResult = app.converter.convert(src);
    if (convertResult.errors && convertResult.errors.length) {
        console.error(convertResult.errors.map((x) => x.messageText).join('\n'));
        return {};
    }
    if (convertResult.project) {
        result = app.serializer.projectToObject(convertResult.project);
    }
    return result;
}
function applyTemplate(src, substitutions) {
    Object.keys(substitutions).forEach((key) => {
        src = src.replace(new RegExp('{{' + key + '}}', 'g'), substitutions[key]);
    });
    return src;
}
function grok(src, options) {
    var _a, _b;
    try {
        gNodes = getReflectionsFromFile(src);
        let sdkName = options.sdkName;
        const packages = (_a = gNodes.groups) === null || _a === void 0 ? void 0 : _a.filter((x) => (x.kind & 3) !== 0);
        const mainPackage = packages &&
            packages[0] &&
            packages[0].children[0] &&
            getReflectionByID(packages[0].children[0]);
        if (!sdkName && mainPackage)
            sdkName = mainPackage.name;
        if (sdkName) {
            if (sdkName.startsWith('"') && sdkName.endsWith('"'))
                sdkName = sdkName.substring(1, sdkName.length - 2);
            if (sdkName.endsWith('.d'))
                sdkName = sdkName.substring(2);
        }
        const packageName = sdkName || gNodes.name || '';
        const content = render(gNodes, 'section');
        if (content) {
            const document = applyTemplate(options.documentTemplate, {
                packageName: escapeYAMLString(packageName),
                sdkName: escapeYAMLString(trimNewline(sdkName || '')),
                content,
            });
            return { [(_b = options === null || options === void 0 ? void 0 : options.outFile) !== null && _b !== void 0 ? _b : 'index.html']: document };
        }
    }
    catch (err) {
        console.error(err);
    }
    return {};
}

exports.grok = grok;
//# sourceMappingURL=grok.js.map
