

define(function(require){
var o=function(k,v,o,l){for(o=o||{},l=k.length;l--;o[k[l]]=v);return o},$V0=[1,18],$V1=[1,8],$V2=[1,19],$V3=[1,20],$V4=[1,15],$V5=[1,16],$V6=[5,14,17],$V7=[1,23],$V8=[1,31],$V9=[1,32],$Va=[1,25],$Vb=[1,24],$Vc=[1,26],$Vd=[1,27],$Ve=[1,28],$Vf=[1,29],$Vg=[1,30],$Vh=[5,8,14,17,19,20,22,30,31,33,34,35,36,37],$Vi=[5,11,14,16,17,26,27,30,31],$Vj=[14,17],$Vk=[5,8,14,17,19,20,30,31],$Vl=[5,8,14,17,19,20,30,31,33,34,35],$Vm=[5,8,14,17,19,20,30,31,33,34,35,36,37],$Vn=[5,8,14,17,20];
var parser = {trace: function trace () { },
yy: {},
symbols_: {"error":2,"SCRIPT":3,"expressionsOptionalTrailingSemi":4,"EOF":5,"expressions":6,"expression":7,";":8,"EXPRESSION_BLOCK":9,"IDENTIFIER":10,"IDENTIFIER_TOKEN":11,"argument":12,"arguments":13,",":14,"FUNCTION_CALL":15,"(":16,")":17,"CONDITIONAL_EXPRESSION":18,"?":19,":":20,"LOGICAL_EXPRESSION":21,"LOGICAL_OPERATOR_TOKEN":22,"ASSIGNMENT":23,"ASSIGNMENT_OPERATOR_TOKEN":24,"number":25,"DIGITS_TOKEN":26,".":27,"NUMBER_LITERAL":28,"UNARY_EXPRESSION":29,"-":30,"+":31,"BINARY_EXPRESSION":32,"*":33,"/":34,"%":35,"&":36,"|":37,"$accept":0,"$end":1},
terminals_: {2:"error",5:"EOF",8:";",11:"IDENTIFIER_TOKEN",14:",",16:"(",17:")",19:"?",20:":",22:"LOGICAL_OPERATOR_TOKEN",24:"ASSIGNMENT_OPERATOR_TOKEN",26:"DIGITS_TOKEN",27:".",30:"-",31:"+",33:"*",34:"/",35:"%",36:"&",37:"|"},
productions_: [0,[3,2],[3,1],[6,2],[6,3],[4,1],[4,2],[9,1],[10,1],[12,1],[12,1],[13,1],[13,3],[15,3],[15,4],[18,5],[21,3],[23,3],[25,1],[25,3],[25,2],[28,1],[29,2],[29,2],[32,3],[32,3],[32,3],[32,3],[32,3],[32,3],[32,3],[7,1],[7,1],[7,3],[7,1],[7,1],[7,1],[7,1],[7,1],[7,1],[7,3]],
performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */) {
/* this == yyval */

var $0 = $$.length - 1;
switch (yystate) {
case 1:
return {type: 'SCRIPT', body: $$[$0-1], column: _$[$0-1].first_column, line: _$[$0-1].first_line}
break;
case 2:
return {type: 'SCRIPT', body: [], column: _$[$0].first_column, line: _$[$0].first_line}
break;
case 3:
this.$ = [$$[$0-1]]
break;
case 4:
this.$ = $$[$0-2].concat([$$[$0-1]])
break;
case 5:
this.$ = $$[$0]
break;
case 6:
this.$ = $$[$0-1].concat([$$[$0]])
break;
case 7:
this.$ = {type: 'EXPRESSION_BLOCK', body: $$[$0], column: _$[$0].first_column, line: _$[$0].first_line}
break;
case 8:
this.$ = {type: 'IDENTIFIER', value: $$[$0], column: _$[$0].first_column, line: _$[$0].first_line};
break;
case 11:
this.$ = [$$[$0]]
break;
case 12:
this.$ = $$[$0-2].concat([$$[$0]])
break;
case 13:
this.$ = {type: 'CALL_EXPRESSION', callee: $$[$0-2], arguments: [], column: _$[$0-2].first_column, line: _$[$0-2].first_line}
break;
case 14:
this.$ = {type: 'CALL_EXPRESSION', callee: $$[$0-3], arguments: $$[$0-1], column: _$[$0-3].first_column, line: _$[$0-3].first_line}
break;
case 15:
this.$ = {type: 'CONDITIONAL_EXPRESSION', test: $$[$0-4], consiquent: $$[$0-2], alternate: $$[$0], column: _$[$0-4].first_column, line: _$[$0-4].first_line}
break;
case 16:
this.$ = {type: 'LOGICAL_EXPRESSION', left: $$[$0-2], right: $$[$0], operator: $$[$0-1], column: _$[$0-2].first_column, line: _$[$0-2].first_line}
break;
case 17:
this.$ = {type: 'ASSIGNMENT_EXPRESSION', left: $$[$0-2], operator: $$[$0-1], right: $$[$0], column: _$[$0-2].first_column, line: _$[$0-2].first_line}
break;
case 18:
this.$ = Number($$[$0])
break;
case 19:
this.$ = Number($$[$0-2] + $$[$0-1] + $$[$0])
break;
case 20:
this.$ = Number('0' + $$[$0-1] + $$[$0])
break;
case 21:
this.$ = {type: 'NUMBER_LITERAL', value: $$[$0], column: _$[$0].first_column, line: _$[$0].first_line}
break;
case 22: case 23:
this.$ = {type: 'UNARY_EXPRESSION', value: $$[$0], operator: $$[$0-1], column: _$[$0-1].first_column, line: _$[$0-1].first_line}
break;
case 24: case 25: case 26: case 27: case 28: case 29: case 30:
this.$ = {type: 'BINARY_EXPRESSION', left: $$[$0-2], right: $$[$0], operator: $$[$0-1], column: _$[$0-2].first_column, line: _$[$0-2].first_line}
break;
case 33: case 40:
this.$ = $$[$0-1]
break;
}
},
table: [{3:1,4:2,5:[1,3],6:4,7:5,10:12,11:$V0,15:11,16:$V1,18:13,21:14,23:10,25:17,26:$V2,27:$V3,28:9,29:7,30:$V4,31:$V5,32:6},{1:[3]},{5:[1,21]},{1:[2,2]},o($V6,[2,5],{32:6,29:7,28:9,23:10,15:11,10:12,18:13,21:14,25:17,7:22,11:$V0,16:$V1,26:$V2,27:$V3,30:$V4,31:$V5}),{8:$V7,19:$V8,22:$V9,30:$Va,31:$Vb,33:$Vc,34:$Vd,35:$Ve,36:$Vf,37:$Vg},o($Vh,[2,31]),o($Vh,[2,32]),{4:35,6:4,7:33,9:34,10:12,11:$V0,15:11,16:$V1,18:13,21:14,23:10,25:17,26:$V2,27:$V3,28:9,29:7,30:$V4,31:$V5,32:6},o($Vh,[2,34]),o($Vh,[2,35]),o($Vh,[2,36]),o($Vh,[2,37],{16:[1,37],24:[1,36]}),o($Vh,[2,38]),o($Vh,[2,39]),{7:38,10:12,11:$V0,15:11,16:$V1,18:13,21:14,23:10,25:17,26:$V2,27:$V3,28:9,29:7,30:$V4,31:$V5,32:6},{7:39,10:12,11:$V0,15:11,16:$V1,18:13,21:14,23:10,25:17,26:$V2,27:$V3,28:9,29:7,30:$V4,31:$V5,32:6},o($Vh,[2,21]),o([5,8,14,16,17,19,20,22,24,30,31,33,34,35,36,37],[2,8]),o($Vh,[2,18],{27:[1,40]}),{26:[1,41]},{1:[2,1]},o($V6,[2,6],{8:[1,42],19:$V8,22:$V9,30:$Va,31:$Vb,33:$Vc,34:$Vd,35:$Ve,36:$Vf,37:$Vg}),o($Vi,[2,3]),{7:43,10:12,11:$V0,15:11,16:$V1,18:13,21:14,23:10,25:17,26:$V2,27:$V3,28:9,29:7,30:$V4,31:$V5,32:6},{7:44,10:12,11:$V0,15:11,16:$V1,18:13,21:14,23:10,25:17,26:$V2,27:$V3,28:9,29:7,30:$V4,31:$V5,32:6},{7:45,10:12,11:$V0,15:11,16:$V1,18:13,21:14,23:10,25:17,26:$V2,27:$V3,28:9,29:7,30:$V4,31:$V5,32:6},{7:46,10:12,11:$V0,15:11,16:$V1,18:13,21:14,23:10,25:17,26:$V2,27:$V3,28:9,29:7,30:$V4,31:$V5,32:6},{7:47,10:12,11:$V0,15:11,16:$V1,18:13,21:14,23:10,25:17,26:$V2,27:$V3,28:9,29:7,30:$V4,31:$V5,32:6},{7:48,10:12,11:$V0,15:11,16:$V1,18:13,21:14,23:10,25:17,26:$V2,27:$V3,28:9,29:7,30:$V4,31:$V5,32:6},{7:49,10:12,11:$V0,15:11,16:$V1,18:13,21:14,23:10,25:17,26:$V2,27:$V3,28:9,29:7,30:$V4,31:$V5,32:6},{7:50,10:12,11:$V0,15:11,16:$V1,18:13,21:14,23:10,25:17,26:$V2,27:$V3,28:9,29:7,30:$V4,31:$V5,32:6},{7:51,10:12,11:$V0,15:11,16:$V1,18:13,21:14,23:10,25:17,26:$V2,27:$V3,28:9,29:7,30:$V4,31:$V5,32:6},{8:$V7,17:[1,52],19:$V8,22:$V9,30:$Va,31:$Vb,33:$Vc,34:$Vd,35:$Ve,36:$Vf,37:$Vg},{17:[1,53]},o($Vj,[2,7]),{7:54,10:12,11:$V0,15:11,16:$V1,18:13,21:14,23:10,25:17,26:$V2,27:$V3,28:9,29:7,30:$V4,31:$V5,32:6},{4:35,6:4,7:58,9:59,10:12,11:$V0,12:57,13:56,15:11,16:$V1,17:[1,55],18:13,21:14,23:10,25:17,26:$V2,27:$V3,28:9,29:7,30:$V4,31:$V5,32:6},o($Vk,[2,22],{22:$V9,33:$Vc,34:$Vd,35:$Ve,36:$Vf,37:$Vg}),o($Vk,[2,23],{22:$V9,33:$Vc,34:$Vd,35:$Ve,36:$Vf,37:$Vg}),{26:[1,60]},o($Vh,[2,20]),o($Vi,[2,4]),o($Vk,[2,24],{22:$V9,33:$Vc,34:$Vd,35:$Ve,36:$Vf,37:$Vg}),o($Vk,[2,25],{22:$V9,33:$Vc,34:$Vd,35:$Ve,36:$Vf,37:$Vg}),o($Vl,[2,26],{22:$V9,36:$Vf,37:$Vg}),o($Vl,[2,27],{22:$V9,36:$Vf,37:$Vg}),o($Vl,[2,28],{22:$V9,36:$Vf,37:$Vg}),o($Vm,[2,29],{22:$V9}),o($Vm,[2,30],{22:$V9}),{19:$V8,20:[1,61],22:$V9,30:$Va,31:$Vb,33:$Vc,34:$Vd,35:$Ve,36:$Vf,37:$Vg},o($Vh,[2,16]),o($Vh,[2,33]),o($Vh,[2,40]),o($Vn,[2,17],{19:$V8,22:$V9,30:$Va,31:$Vb,33:$Vc,34:$Vd,35:$Ve,36:$Vf,37:$Vg}),o($Vh,[2,13]),{14:[1,63],17:[1,62]},o($Vj,[2,11]),o($Vj,[2,9],{8:$V7,19:$V8,22:$V9,30:$Va,31:$Vb,33:$Vc,34:$Vd,35:$Ve,36:$Vf,37:$Vg}),o($Vj,[2,10]),o($Vh,[2,19]),{7:64,10:12,11:$V0,15:11,16:$V1,18:13,21:14,23:10,25:17,26:$V2,27:$V3,28:9,29:7,30:$V4,31:$V5,32:6},o($Vh,[2,14]),{4:35,6:4,7:58,9:59,10:12,11:$V0,12:65,15:11,16:$V1,18:13,21:14,23:10,25:17,26:$V2,27:$V3,28:9,29:7,30:$V4,31:$V5,32:6},o($Vn,[2,15],{19:$V8,22:$V9,30:$Va,31:$Vb,33:$Vc,34:$Vd,35:$Ve,36:$Vf,37:$Vg}),o($Vj,[2,12])],
defaultActions: {3:[2,2],21:[2,1]},
parseError: function parseError (str, hash) {
    if (hash.recoverable) {
        this.trace(str);
    } else {
        var error = new Error(str);
        error.hash = hash;
        throw error;
    }
},
parse: function parse(input) {
    var self = this, stack = [0], tstack = [], vstack = [null], lstack = [], table = this.table, yytext = '', yylineno = 0, yyleng = 0, recovering = 0, TERROR = 2, EOF = 1;
    var args = lstack.slice.call(arguments, 1);
    var lexer = Object.create(this.lexer);
    var sharedState = { yy: {} };
    for (var k in this.yy) {
        if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
            sharedState.yy[k] = this.yy[k];
        }
    }
    lexer.setInput(input, sharedState.yy);
    sharedState.yy.lexer = lexer;
    sharedState.yy.parser = this;
    if (typeof lexer.yylloc == 'undefined') {
        lexer.yylloc = {};
    }
    var yyloc = lexer.yylloc;
    lstack.push(yyloc);
    var ranges = lexer.options && lexer.options.ranges;
    if (typeof sharedState.yy.parseError === 'function') {
        this.parseError = sharedState.yy.parseError;
    } else {
        this.parseError = Object.getPrototypeOf(this).parseError;
    }
    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }
    _token_stack:
        var lex = function () {
            var token;
            token = lexer.lex() || EOF;
            if (typeof token !== 'number') {
                token = self.symbols_[token] || token;
            }
            return token;
        };
    var symbol, preErrorSymbol, state, action, a, r, yyval = {}, p, len, newState, expected;
    while (true) {
        state = stack[stack.length - 1];
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol === null || typeof symbol == 'undefined') {
                symbol = lex();
            }
            action = table[state] && table[state][symbol];
        }
                    if (typeof action === 'undefined' || !action.length || !action[0]) {
                var errStr = '';
                expected = [];
                for (p in table[state]) {
                    if (this.terminals_[p] && p > TERROR) {
                        expected.push('\'' + this.terminals_[p] + '\'');
                    }
                }
                if (lexer.showPosition) {
                    errStr = 'Parse error on line ' + (yylineno + 1) + ':\n' + lexer.showPosition() + '\nExpecting ' + expected.join(', ') + ', got \'' + (this.terminals_[symbol] || symbol) + '\'';
                } else {
                    errStr = 'Parse error on line ' + (yylineno + 1) + ': Unexpected ' + (symbol == EOF ? 'end of input' : '\'' + (this.terminals_[symbol] || symbol) + '\'');
                }
                this.parseError(errStr, {
                    text: lexer.match,
                    token: this.terminals_[symbol] || symbol,
                    line: lexer.yylineno,
                    loc: yyloc,
                    expected: expected
                });
            }
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol);
        }
        switch (action[0]) {
        case 1:
            stack.push(symbol);
            vstack.push(lexer.yytext);
            lstack.push(lexer.yylloc);
            stack.push(action[1]);
            symbol = null;
            if (!preErrorSymbol) {
                yyleng = lexer.yyleng;
                yytext = lexer.yytext;
                yylineno = lexer.yylineno;
                yyloc = lexer.yylloc;
                if (recovering > 0) {
                    recovering--;
                }
            } else {
                symbol = preErrorSymbol;
                preErrorSymbol = null;
            }
            break;
        case 2:
            len = this.productions_[action[1]][1];
            yyval.$ = vstack[vstack.length - len];
            yyval._$ = {
                first_line: lstack[lstack.length - (len || 1)].first_line,
                last_line: lstack[lstack.length - 1].last_line,
                first_column: lstack[lstack.length - (len || 1)].first_column,
                last_column: lstack[lstack.length - 1].last_column
            };
            if (ranges) {
                yyval._$.range = [
                    lstack[lstack.length - (len || 1)].range[0],
                    lstack[lstack.length - 1].range[1]
                ];
            }
            r = this.performAction.apply(yyval, [
                yytext,
                yyleng,
                yylineno,
                sharedState.yy,
                action[1],
                vstack,
                lstack
            ].concat(args));
            if (typeof r !== 'undefined') {
                return r;
            }
            if (len) {
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
                lstack = lstack.slice(0, -1 * len);
            }
            stack.push(this.productions_[action[1]][0]);
            vstack.push(yyval.$);
            lstack.push(yyval._$);
            newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
            stack.push(newState);
            break;
        case 3:
            return true;
        }
    }
    return true;
}};

/* generated by jison-lex 0.3.4 */
var lexer = (function(){
var lexer = ({

EOF:1,

parseError:function parseError(str, hash) {
        if (this.yy.parser) {
            this.yy.parser.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },

// resets the lexer, sets new input
setInput:function (input, yy) {
        this.yy = yy || this.yy || {};
        this._input = input;
        this._more = this._backtrack = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {
            first_line: 1,
            first_column: 0,
            last_line: 1,
            last_column: 0
        };
        if (this.options.ranges) {
            this.yylloc.range = [0,0];
        }
        this.offset = 0;
        return this;
    },

// consumes and returns one char from the input
input:function () {
        var ch = this._input[0];
        this.yytext += ch;
        this.yyleng++;
        this.offset++;
        this.match += ch;
        this.matched += ch;
        var lines = ch.match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno++;
            this.yylloc.last_line++;
        } else {
            this.yylloc.last_column++;
        }
        if (this.options.ranges) {
            this.yylloc.range[1]++;
        }

        this._input = this._input.slice(1);
        return ch;
    },

// unshifts one char (or a string) into the input
unput:function (ch) {
        var len = ch.length;
        var lines = ch.split(/(?:\r\n?|\n)/g);

        this._input = ch + this._input;
        this.yytext = this.yytext.substr(0, this.yytext.length - len);
        //this.yyleng -= len;
        this.offset -= len;
        var oldLines = this.match.split(/(?:\r\n?|\n)/g);
        this.match = this.match.substr(0, this.match.length - 1);
        this.matched = this.matched.substr(0, this.matched.length - 1);

        if (lines.length - 1) {
            this.yylineno -= lines.length - 1;
        }
        var r = this.yylloc.range;

        this.yylloc = {
            first_line: this.yylloc.first_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.first_column,
            last_column: lines ?
                (lines.length === oldLines.length ? this.yylloc.first_column : 0)
                 + oldLines[oldLines.length - lines.length].length - lines[0].length :
              this.yylloc.first_column - len
        };

        if (this.options.ranges) {
            this.yylloc.range = [r[0], r[0] + this.yyleng - len];
        }
        this.yyleng = this.yytext.length;
        return this;
    },

// When called from action, caches matched text and appends it on next action
more:function () {
        this._more = true;
        return this;
    },

// When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
reject:function () {
        if (this.options.backtrack_lexer) {
            this._backtrack = true;
        } else {
            return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).\n' + this.showPosition(), {
                text: "",
                token: null,
                line: this.yylineno
            });

        }
        return this;
    },

// retain first n characters of the match
less:function (n) {
        this.unput(this.match.slice(n));
    },

// displays already matched input, i.e. for error messages
pastInput:function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },

// displays upcoming input, i.e. for error messages
upcomingInput:function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20) + (next.length > 20 ? '...' : '')).replace(/\n/g, "");
    },

// displays the character position where the lexing error occurred, i.e. for error messages
showPosition:function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c + "^";
    },

// test the lexed token: return FALSE when not a match, otherwise return token
test_match:function(match, indexed_rule) {
        var token,
            lines,
            backup;

        if (this.options.backtrack_lexer) {
            // save context
            backup = {
                yylineno: this.yylineno,
                yylloc: {
                    first_line: this.yylloc.first_line,
                    last_line: this.last_line,
                    first_column: this.yylloc.first_column,
                    last_column: this.yylloc.last_column
                },
                yytext: this.yytext,
                match: this.match,
                matches: this.matches,
                matched: this.matched,
                yyleng: this.yyleng,
                offset: this.offset,
                _more: this._more,
                _input: this._input,
                yy: this.yy,
                conditionStack: this.conditionStack.slice(0),
                done: this.done
            };
            if (this.options.ranges) {
                backup.yylloc.range = this.yylloc.range.slice(0);
            }
        }

        lines = match[0].match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno += lines.length;
        }
        this.yylloc = {
            first_line: this.yylloc.last_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.last_column,
            last_column: lines ?
                         lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length :
                         this.yylloc.last_column + match[0].length
        };
        this.yytext += match[0];
        this.match += match[0];
        this.matches = match;
        this.yyleng = this.yytext.length;
        if (this.options.ranges) {
            this.yylloc.range = [this.offset, this.offset += this.yyleng];
        }
        this._more = false;
        this._backtrack = false;
        this._input = this._input.slice(match[0].length);
        this.matched += match[0];
        token = this.performAction.call(this, this.yy, this, indexed_rule, this.conditionStack[this.conditionStack.length - 1]);
        if (this.done && this._input) {
            this.done = false;
        }
        if (token) {
            return token;
        } else if (this._backtrack) {
            // recover context
            for (var k in backup) {
                this[k] = backup[k];
            }
            return false; // rule action called reject() implying the next rule should be tested instead.
        }
        return false;
    },

// return next match in input
next:function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) {
            this.done = true;
        }

        var token,
            match,
            tempMatch,
            index;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i = 0; i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (this.options.backtrack_lexer) {
                    token = this.test_match(tempMatch, rules[i]);
                    if (token !== false) {
                        return token;
                    } else if (this._backtrack) {
                        match = false;
                        continue; // rule action called reject() implying a rule MISmatch.
                    } else {
                        // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
                        return false;
                    }
                } else if (!this.options.flex) {
                    break;
                }
            }
        }
        if (match) {
            token = this.test_match(match, rules[index]);
            if (token !== false) {
                return token;
            }
            // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
            return false;
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. Unrecognized text.\n' + this.showPosition(), {
                text: "",
                token: null,
                line: this.yylineno
            });
        }
    },

// return next match that has a token
lex:function lex () {
        var r = this.next();
        if (r) {
            return r;
        } else {
            return this.lex();
        }
    },

// activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
begin:function begin (condition) {
        this.conditionStack.push(condition);
    },

// pop the previously active lexer condition state off the condition stack
popState:function popState () {
        var n = this.conditionStack.length - 1;
        if (n > 0) {
            return this.conditionStack.pop();
        } else {
            return this.conditionStack[0];
        }
    },

// produce the lexer rule set which is active for the currently active lexer condition state
_currentRules:function _currentRules () {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
            return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        } else {
            return this.conditions["INITIAL"].rules;
        }
    },

// return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
topState:function topState (n) {
        n = this.conditionStack.length - 1 - Math.abs(n || 0);
        if (n >= 0) {
            return this.conditionStack[n];
        } else {
            return "INITIAL";
        }
    },

// alias for begin(condition)
pushState:function pushState (condition) {
        this.begin(condition);
    },

// return the number of states currently on the stack
stateStackSize:function stateStackSize() {
        return this.conditionStack.length;
    },
options: {},
performAction: function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {
var YYSTATE=YY_START;
switch($avoiding_name_collisions) {
case 0:/* skip whitespace */
break;
case 1:/* skip inline comments */
break;
case 2:return 26
break;
case 3:return 24
break;
case 4:return 22
break;
case 5:return 11
break;
case 6:return 5
break;
case 7:return yy_.yytext[0]
break;
}
},
rules: [/^(?:\s+)/,/^(?:\/\/[^\n]*)/,/^(?:[0-9]+)/,/^(?:[+\-*/%]?=)/,/^(?:(\&\&)|\|\|)/,/^(?:[a-zA-Z_][a-zA-Z0-9._]*)/,/^(?:$)/,/^(?:.)/],
conditions: {"INITIAL":{"rules":[0,1,2,3,4,5,6,7],"inclusive":true}}
});
return lexer;
})();
parser.lexer = lexer;
return parser;
});
