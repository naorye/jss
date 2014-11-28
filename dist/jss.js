!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.jss=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = require('./lib/index')

},{"./lib/index":4}],2:[function(require,module,exports){
'use strict'

var uid = 0

var hasKeyframes = /@keyframes/

var toString = Object.prototype.toString

/**
 * Rule is selector + style hash.
 *
 * @param {String} [selector]
 * @param {Object} style is property:value hash.
 * @param {Object} [stylesheet]
 * @api public
 */
function Rule(selector, style, stylesheet) {
    if (typeof selector == 'object') {
        stylesheet = style
        style = selector
        selector = null
    }

    if (selector) {
        this.selector = selector
    } else {
        this.className = Rule.NAMESPACE_PREFIX + '-' + uid
        uid++
        this.selector = '.' + this.className
    }

    this.stylesheet = stylesheet
    this.style = style
}

module.exports = Rule

Rule.NAMESPACE_PREFIX = 'jss'

/**
 * Add child rule. Required for plugins like "nested".
 * Stylesheet will render them as a separate rule.
 *
 * @param {String} selector
 * @param {Object} style
 * @return {Rule}
 * @api public
 */
Rule.prototype.addChild = function (selector, style) {
    if (!this.children) this.children = {}
    this.children[selector] = style

    return this
}

/**
 * Converts the rule to css string.
 *
 * @return {String}
 * @api public
 */
Rule.prototype.toString = function () {
    var isKeyframe = hasKeyframes.test(this.selector)
    var style = this.style
    var str = this.selector + ' {'

    for (var prop in style) {
        var value = style[prop]
        if (typeof value == 'object') {
            var type = toString.call(value)
            // We are in a sub block e.g. @media, @keyframes
            if (type == '[object Object]') {
                var valueStr = '{'
                for (var prop2 in value) {
                    valueStr += '\n    ' + prop2 + ': ' + value[prop2] + ';'
                }
                valueStr += '\n  }'
                value = valueStr
                str += '\n  ' + prop + (isKeyframe ? ' ' : ': ') + value
            // We want to generate multiple declarations with identical property names.
            } else if (type == '[object Array]') {
                for (var i = 0; i < value.length; i++) {
                    str += '\n  ' + prop + ': ' + value[i] + ';'
                }
            }
        } else {
            str += '\n  ' + prop + ': ' + value + ';'
        }
    }

    str += '\n}'

    return str
}

},{}],3:[function(require,module,exports){
'use strict'

var Rule = require('./Rule')
var plugins = require('./plugins')

/**
 * Stylesheet abstraction, contains rules, injects stylesheet into dom.
 *
 * @param {Object} [rules] object with selectors and declarations
 * @param {Boolean} [named] rules have names if true, class names will be generated.
 * @param {Object} [attributes] stylesheet element attributes
 * @api public
 */
function Stylesheet(rules, named, attributes) {
    if (typeof named == 'object') {
        attributes = named
        named = false
    }
    this.element = null
    this.attached = false
    this.named = named || false
    this.attributes = attributes
    this.rules = {}
    this.classes = {}
    this.text = ''
    this.element = this.createElement()

    for (var key in rules) {
        this.createRules(key, rules[key])
    }
}

module.exports = Stylesheet

/**
 * Insert stylesheet element to render tree.
 *
 * @api public
 * @return {Stylesheet}
 */
Stylesheet.prototype.attach = function () {
    if (this.attached) return this

    if (!this.text) this.deploy()

    document.head.appendChild(this.element)
    this.attached = true

    return this
}

/**
 * Stringify and inject the rules.
 *
 * @return {Stylesheet}
 * @api private
 */
Stylesheet.prototype.deploy = function () {
    this.text = this.toString()
    this.element.innerHTML = '\n' + this.text + '\n'

    return this
}

/**
 * Remove stylesheet element from render tree.
 *
 * @return {Stylesheet}
 * @api public
 */
Stylesheet.prototype.detach = function () {
    if (!this.attached) return this

    this.element.parentNode.removeChild(this.element)
    this.attached = false

    return this
}

/**
 * Add a rule to the current stylesheet. Will insert a rule also after the stylesheet
 * has been rendered first time.
 *
 * @param {Object} [key] can be selector or name if `this.named` is true
 * @param {Object} style property/value hash
 * @return {Rule}
 * @api public
 */
Stylesheet.prototype.addRule = function (key, style) {
    var rules = this.createRules(key, style)

    // Don't insert rule directly if there is no stringified version yet.
    // It will be inserted all together when .attach is called.
    if (this.text) {
        var sheet = this.element.sheet
        for (var i = 0; i < rules.length; i++) {
            sheet.insertRule(rules[i].toString(), sheet.cssRules.length)
        }
    } else {
        this.deploy()
    }

    return rules
}

/**
 * Create rules, will render also after stylesheet was rendered the first time.
 *
 * @param {Object} rules key:style hash.
 * @return {Stylesheet} this
 * @api public
 */
Stylesheet.prototype.addRules = function (rules) {
    for (var key in rules) {
        this.addRule(key, rules[key])
    }

    return this
}

/**
 * Get a rule.
 *
 * @param {String} key can be selector or name if `named` is true.
 * @return {Rule}
 * @api public
 */
Stylesheet.prototype.getRule = function (key) {
    return this.rules[key]
}

/**
 * Convert rules to a css string.
 *
 * @return {String}
 * @api public
 */
Stylesheet.prototype.toString = function () {
    var str = ''
    var rules = this.rules

    for (var key in rules) {
        if (str) str += '\n'
        str += rules[key].toString()
    }

    return str
}

/**
 * Create a rule, will not render after stylesheet was rendered the first time.
 *
 * @param {Object} [selector] if you don't pass selector - it will be generated
 * @param {Object} style property/value hash
 * @return {Array} rule can contain child rules
 * @api private
 */
Stylesheet.prototype.createRules = function (key, style) {
    var rules = []
    var selector, name

    if (this.named) name = key
    else selector = key

    var rule = new Rule(selector, style, this)
    rules.push(rule)
    this.rules[name || rule.selector] = rule
    if (this.named) this.classes[name] = rule.className
    plugins.run(rule)

    for (key in rule.children) {
        rules.push(this.createRules(key, rule.children[key]))
    }

    return rules
}

/**
 * Create stylesheet element.
 *
 * @api private
 * @return {Element}
 */
Stylesheet.prototype.createElement = function () {
    var el = document.createElement('style')

    if (this.attributes) {
        for (var name in this.attributes) {
            el.setAttribute(name, this.attributes[name])
        }
    }

    return el
}

},{"./Rule":2,"./plugins":5}],4:[function(require,module,exports){
/**
 * Stylesheets written in javascript.
 *
 * @copyright Oleg Slobodskoi 2014
 * @website https://github.com/kof/jss
 * @license MIT
 */

'use strict'

var Stylesheet = require('./Stylesheet')
var Rule = require('./Rule')

exports.Stylesheet = Stylesheet

exports.Rule = Rule

exports.vendorPrefix = require('./vendorPrefix')

exports.support = require('./support')

exports.plugins = require('./plugins')

/**
 * Create a stylesheet.
 *
 * @param {Object} rules is selector:style hash.
 * @param {Object} [named] rules have names if true, class names will be generated.
 * @param {Object} [attributes] stylesheet element attributes.
 * @return {Stylesheet}
 * @api public
 */
exports.createStylesheet = function (rules, named, attributes) {
    return new Stylesheet(rules, named, attributes)
}

/**
 * Create a rule.
 *
 * @param {String} [selector]
 * @param {Object} style is property:value hash.
 * @return {Rule}
 * @api public
 */
exports.createRule = function (selector, style) {
    var rule = new Rule(selector, style)
    exports.plugins.run(rule)
    return rule
}

/**
 * Register plugin. Passed function will be invoked with a rule instance.
 *
 * @param {Function} fn
 * @api public
 */
exports.use = exports.plugins.use

},{"./Rule":2,"./Stylesheet":3,"./plugins":5,"./support":9,"./vendorPrefix":10}],5:[function(require,module,exports){
'use strict'

/**
 * Registered plugins.
 *
 * @type {Array}
 * @api public
 */
exports.registry = [
    require('./plugins/nested'),
    require('./plugins/extend'),
    require('./plugins/vendorPrefixer')
]

/**
 * Register plugin. Passed function will be invoked with a rule instance.
 *
 * @param {Function} fn
 * @api public
 */
exports.use = function (fn) {
    exports.registry.push(fn)
}

/**
 * Execute all registered plugins.
 *
 * @param {Rule} rule
 * @api private
 */
exports.run = function (rule) {
    for (var i = 0; i < exports.registry.length; i++) {
        exports.registry[i](rule)
    }
}

},{"./plugins/extend":6,"./plugins/nested":7,"./plugins/vendorPrefixer":8}],6:[function(require,module,exports){
'use strict'

var toString = Object.prototype.toString

/**
 * Handle `extend` property.
 *
 * @param {Rule} rule
 * @api private
 */
module.exports = function (rule) {
    var style = rule.style

    if (!style || !style.extend) return

    var newStyle = {}

    ;(function extend(style) {
        if (toString.call(style.extend) == '[object Array]') {
            for (var i = 0; i < style.extend.length; i++) {
                extend(style.extend[i])
            }
        } else {
            for (var prop in style.extend) {
                if (prop == 'extend') extend(style.extend.extend)
                else newStyle[prop] = style.extend[prop]
            }
        }

        // Copy base style.
        for (var prop in style) {
            if (prop != 'extend') newStyle[prop] = style[prop]
        }
    }(style))

    rule.style = newStyle
}

},{}],7:[function(require,module,exports){
'use strict'

var regExp = /&/gi

/**
 * Convert nested rules to separate, remove them from original styles.
 *
 * @param {Rule} rule
 * @api private
 */
module.exports = function (rule) {
    var stylesheet = rule.stylesheet
    var style = rule.style

    for (var prop in style) {
        if (prop[0] == '&') {
            var selector = prop.replace(regExp, rule.selector)
            rule.addChild(selector, style[prop])
            delete style[prop]
        }
    }
}

},{}],8:[function(require,module,exports){
'use strict'

var jss = require('..')

/**
 * Add vendor prefix to a property name when needed.
 *
 * @param {Rule} rule
 * @api private
 */
module.exports = function (rule) {
    var style = rule.style

    for (var prop in style) {
        var supportedProp = jss.support.getProp(prop)
        if (supportedProp) {
            style[supportedProp] = style[prop]
            delete style[prop]
        }
    }
}

},{"..":4}],9:[function(require,module,exports){
'use strict'

var vendorPrefix = require('./vendorPrefix')

/**
 * We test every property on vendor prefix requirement.
 * Once tested, result is cached. It gives us up to 70% perf boost.
 * http://jsperf.com/element-style-object-access-vs-plain-object
 */
var cache = {}

var p = document.createElement('p')

// Prefill cache with known css properties to reduce amount of
// properties we need to feature test.
// http://davidwalsh.name/vendor-prefix
;(function() {
    var computed = window.getComputedStyle(document.documentElement, '')
    for (var key in computed) {
        cache[computed[key]] = false
    }
}())

// Convert dash separated strings to camel cased.
var camelize = (function () {
    var regExp = /[-\s]+(.)?/g

    function toUpper(match, c) {
        return c ? c.toUpperCase() : ''
    }

    return function(str) {
        return str.replace(regExp, toUpper)
    }
}())

/**
 * Test if a property is supported, returns property with vendor
 * prefix if required, otherwise `false`.
 *
 * @param {String} prop
 * @return {String|Boolean}
 * @api private
 */
exports.getProp = function (prop) {
    // We have not tested this prop yet, lets do the test.
    if (cache[prop] == null) {
        var camelized = vendorPrefix.js + camelize('-' + prop)
        var dasherized = vendorPrefix.css + prop
        // Test if property is supported.
        // Camelization is required because we can't test using
        // css syntax e.g. in ff.
        cache[prop] = camelized in p.style ? dasherized : false
    }

    return cache[prop]
}

},{"./vendorPrefix":10}],10:[function(require,module,exports){
'use strict'

var jsCssMap = {
    Webkit: '-webkit-',
    Moz: '-moz-',
    // IE did it wrong again ...
    ms: '-ms-',
    O: '-o-'
}

var style = document.createElement('p').style
var testProp = 'Transform'

for (var js in jsCssMap) {
    if ((js + testProp) in style) {
        exports.js = js
        exports.css = jsCssMap[js]
        break
    }
}

},{}]},{},[1])(1)
});