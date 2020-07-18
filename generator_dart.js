/**
 * @license
 * Copyright 2014 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Helper functions for generating Dart for blocks.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

goog.provide('Blockly.Dart');

goog.require('Blockly.Generator');
goog.require('Blockly.utils.string');


/**
 * Dart code generator.
 * @type {!Blockly.Generator}
 */
Blockly.Dart = new Blockly.Generator('Dart');

/**
 * List of illegal variable names.
 * This is not intended to be a security feature.  Blockly is 100% client-side,
 * so bypassing this list is trivial.  This is intended to prevent users from
 * accidentally clobbering a built-in object or function.
 * @private
 */
Blockly.Dart.addReservedWords(
    // https://www.dartlang.org/docs/spec/latest/dart-language-specification.pdf
    // Section 16.1.1
    'assert,break,case,catch,class,const,continue,default,do,else,enum,' +
    'extends,false,final,finally,for,if,in,is,new,null,rethrow,return,super,' +
    'switch,this,throw,true,try,var,void,while,with,' +
    // https://api.dartlang.org/dart_core.html
    'print,identityHashCode,identical,BidirectionalIterator,Comparable,' +
    'double,Function,int,Invocation,Iterable,Iterator,List,Map,Match,num,' +
    'Pattern,RegExp,Set,StackTrace,String,StringSink,Type,bool,DateTime,' +
    'Deprecated,Duration,Expando,Null,Object,RuneIterator,Runes,Stopwatch,' +
    'StringBuffer,Symbol,Uri,Comparator,AbstractClassInstantiationError,' +
    'ArgumentError,AssertionError,CastError,ConcurrentModificationError,' +
    'CyclicInitializationError,Error,Exception,FallThroughError,' +
    'FormatException,IntegerDivisionByZeroException,NoSuchMethodError,' +
    'NullThrownError,OutOfMemoryError,RangeError,StackOverflowError,' +
    'StateError,TypeError,UnimplementedError,UnsupportedError'
);

/**
 * Order of operation ENUMs.
 * https://www.dartlang.org/docs/dart-up-and-running/ch02.html#operator_table
 */
Blockly.Dart.ORDER_ATOMIC = 0;         // 0 "" ...
Blockly.Dart.ORDER_UNARY_POSTFIX = 1;  // expr++ expr-- () [] . ?.
Blockly.Dart.ORDER_UNARY_PREFIX = 2;   // -expr !expr ~expr ++expr --expr
Blockly.Dart.ORDER_MULTIPLICATIVE = 3; // * / % ~/
Blockly.Dart.ORDER_ADDITIVE = 4;       // + -
Blockly.Dart.ORDER_SHIFT = 5;          // << >>
Blockly.Dart.ORDER_BITWISE_AND = 6;    // &
Blockly.Dart.ORDER_BITWISE_XOR = 7;    // ^
Blockly.Dart.ORDER_BITWISE_OR = 8;     // |
Blockly.Dart.ORDER_RELATIONAL = 9;     // >= > <= < as is is!
Blockly.Dart.ORDER_EQUALITY = 10;      // == !=
Blockly.Dart.ORDER_LOGICAL_AND = 11;   // &&
Blockly.Dart.ORDER_LOGICAL_OR = 12;    // ||
Blockly.Dart.ORDER_IF_NULL = 13;       // ??
Blockly.Dart.ORDER_CONDITIONAL = 14;   // expr ? expr : expr
Blockly.Dart.ORDER_CASCADE = 15;       // ..
Blockly.Dart.ORDER_ASSIGNMENT = 16;    // = *= /= ~/= %= += -= <<= >>= &= ^= |=
Blockly.Dart.ORDER_NONE = 99;          // (...)

/**
 * Initialise the database of variable names.
 * @param {!Blockly.Workspace} workspace Workspace to generate code from.
 */
Blockly.Dart.init = function(workspace) {
  // Create a dictionary of definitions to be printed before the code.
  Blockly.Dart.definitions_ = Object.create(null);
  // Create a dictionary mapping desired function names in definitions_
  // to actual function names (to avoid collisions with user functions).
  Blockly.Dart.functionNames_ = Object.create(null);

  if (!Blockly.Dart.variableDB_) {
    Blockly.Dart.variableDB_ =
        new Blockly.Names(Blockly.Dart.RESERVED_WORDS_);
  } else {
    Blockly.Dart.variableDB_.reset();
  }

  Blockly.Dart.variableDB_.setVariableMap(workspace.getVariableMap());

  var defvars = [];
  // Add developer variables (not created or named by the user).
  var devVarList = Blockly.Variables.allDeveloperVariables(workspace);
  for (var i = 0; i < devVarList.length; i++) {
    defvars.push(Blockly.Dart.variableDB_.getName(devVarList[i],
        Blockly.Names.DEVELOPER_VARIABLE_TYPE));
  }

  // Add user variables, but only ones that are being used.
  var variables = Blockly.Variables.allUsedVarModels(workspace);
  for (var i = 0; i < variables.length; i++) {
    defvars.push(Blockly.Dart.variableDB_.getName(variables[i].getId(),
        Blockly.VARIABLE_CATEGORY_NAME));
  }

  // Declare all of the variables.
  if (defvars.length) {
    Blockly.Dart.definitions_['variables'] =
        'var ' + defvars.join(', ') + ';';
  }
};

/**
 * Prepend the generated code with the variable definitions.
 * @param {string} code Generated code.
 * @return {string} Completed code.
 */
Blockly.Dart.finish = function(code) {
  // Indent every line.
  if (code) {
    code = Blockly.Dart.prefixLines(code, Blockly.Dart.INDENT);
  }
  code = 'main() {\n' + code + '}';

  // Convert the definitions dictionary into a list.
  var imports = [];
  var definitions = [];
  for (var name in Blockly.Dart.definitions_) {
    var def = Blockly.Dart.definitions_[name];
    if (def.match(/^import\s/)) {
      imports.push(def);
    } else {
      definitions.push(def);
    }
  }
  // Clean up temporary data.
  delete Blockly.Dart.definitions_;
  delete Blockly.Dart.functionNames_;
  Blockly.Dart.variableDB_.reset();
  var allDefs = imports.join('\n') + '\n\n' + definitions.join('\n\n');
  return allDefs.replace(/\n\n+/g, '\n\n').replace(/\n*$/, '\n\n\n') + code;
};

/**
 * Naked values are top-level blocks with outputs that aren't plugged into
 * anything.  A trailing semicolon is needed to make this legal.
 * @param {string} line Line of generated code.
 * @return {string} Legal line of code.
 */
Blockly.Dart.scrubNakedValue = function(line) {
  return line + ';\n';
};

/**
 * Encode a string as a properly escaped Dart string, complete with quotes.
 * @param {string} string Text to encode.
 * @return {string} Dart string.
 * @private
 */
Blockly.Dart.quote_ = function(string) {
  // Can't use goog.string.quote since $ must also be escaped.
  string = string.replace(/\\/g, '\\\\')
                 .replace(/\n/g, '\\\n')
                 .replace(/\$/g, '\\$')
                 .replace(/'/g, '\\\'');
  return '\'' + string + '\'';
};

/**
 * Encode a string as a properly escaped multiline Dart string, complete with
 * quotes.
 * @param {string} string Text to encode.
 * @return {string} Dart string.
 * @private
 */
Blockly.Dart.multiline_quote_ = function(string) {
  // Can't use goog.string.quote since $ must also be escaped.
  string = string.replace(/'''/g, '\\\'\\\'\\\'');
  return '\'\'\'' + string + '\'\'\'';
};


/**
 * Common tasks for generating Dart from blocks.
 * Handles comments for the specified block and any connected value blocks.
 * Calls any statements following this block.
 * @param {!Blockly.Block} block The current block.
 * @param {string} code The Dart code created for this block.
 * @param {boolean=} opt_thisOnly True to generate code for only this statement.
 * @return {string} Dart code with comments and subsequent blocks added.
 * @private
 */
Blockly.Dart.scrub_ = function(block, code, opt_thisOnly) {
  var commentCode = '';
  // Only collect comments for blocks that aren't inline.
  if (!block.outputConnection || !block.outputConnection.targetConnection) {
    // Collect comment for this block.
    var comment = block.getCommentText();
    if (comment) {
      comment = Blockly.utils.string.wrap(comment,
          Blockly.Dart.COMMENT_WRAP - 3);
      if (block.getProcedureDef) {
        // Use documentation comment for function comments.
        commentCode += Blockly.Dart.prefixLines(comment + '\n', '/// ');
      } else {
        commentCode += Blockly.Dart.prefixLines(comment + '\n', '// ');
      }
    }
    // Collect comments for all value arguments.
    // Don't collect comments for nested statements.
    for (var i = 0; i < block.inputList.length; i++) {
      if (block.inputList[i].type == Blockly.INPUT_VALUE) {
        var childBlock = block.inputList[i].connection.targetBlock();
        if (childBlock) {
          comment = Blockly.Dart.allNestedComments(childBlock);
          if (comment) {
            commentCode += Blockly.Dart.prefixLines(comment, '// ');
          }
        }
      }
    }
  }
  var nextBlock = block.nextConnection && block.nextConnection.targetBlock();
  var nextCode = opt_thisOnly ? '' : Blockly.Dart.blockToCode(nextBlock);
  return commentCode + code + nextCode;
};

/**
 * Gets a property and adjusts the value while taking into account indexing.
 * @param {!Blockly.Block} block The block.
 * @param {string} atId The property ID of the element to get.
 * @param {number=} opt_delta Value to add.
 * @param {boolean=} opt_negate Whether to negate the value.
 * @param {number=} opt_order The highest order acting on this value.
 * @return {string|number}
 */
Blockly.Dart.getAdjusted = function(block, atId, opt_delta, opt_negate,
    opt_order) {
  var delta = opt_delta || 0;
  var order = opt_order || Blockly.Dart.ORDER_NONE;
  if (block.workspace.options.oneBasedIndex) {
    delta--;
  }
  var defaultAtIndex = block.workspace.options.oneBasedIndex ? '1' : '0';
  if (delta) {
    var at = Blockly.Dart.valueToCode(block, atId,
        Blockly.Dart.ORDER_ADDITIVE) || defaultAtIndex;
  } else if (opt_negate) {
    var at = Blockly.Dart.valueToCode(block, atId,
        Blockly.Dart.ORDER_UNARY_PREFIX) || defaultAtIndex;
  } else {
    var at = Blockly.Dart.valueToCode(block, atId, order) ||
        defaultAtIndex;
  }

  if (Blockly.isNumber(at)) {
    // If the index is a naked number, adjust it right now.
    at = parseInt(at, 10) + delta;
    if (opt_negate) {
      at = -at;
    }
  } else {
    // If the index is dynamic, adjust it in code.
    if (delta > 0) {
      at = at + ' + ' + delta;
      var innerOrder = Blockly.Dart.ORDER_ADDITIVE;
    } else if (delta < 0) {
      at = at + ' - ' + -delta;
      var innerOrder = Blockly.Dart.ORDER_ADDITIVE;
    }
    if (opt_negate) {
      if (delta) {
        at = '-(' + at + ')';
      } else {
        at = '-' + at;
      }
      var innerOrder = Blockly.Dart.ORDER_UNARY_PREFIX;
    }
    innerOrder = Math.floor(innerOrder);
    order = Math.floor(order);
    if (innerOrder && order >= innerOrder) {
      at = '(' + at + ')';
    }
  }
  return at;
};
/**
 * @license
 * Copyright 2014 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Generating Dart for colour blocks.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

goog.provide('Blockly.Dart.colour');

goog.require('Blockly.Dart');


Blockly.Dart.addReservedWords('Math');

Blockly.Dart['colour_picker'] = function(block) {
  // Colour picker.
  var code = Blockly.Dart.quote_(block.getFieldValue('COLOUR'));
  return [code, Blockly.Dart.ORDER_ATOMIC];
};

Blockly.Dart['colour_random'] = function(block) {
  // Generate a random colour.
  Blockly.Dart.definitions_['import_dart_math'] =
      'import \'dart:math\' as Math;';
  var functionName = Blockly.Dart.provideFunction_(
      'colour_random',
      ['String ' + Blockly.Dart.FUNCTION_NAME_PLACEHOLDER_ + '() {',
       '  String hex = \'0123456789abcdef\';',
       '  var rnd = new Math.Random();',
       '  return \'#${hex[rnd.nextInt(16)]}${hex[rnd.nextInt(16)]}\'',
       '      \'${hex[rnd.nextInt(16)]}${hex[rnd.nextInt(16)]}\'',
       '      \'${hex[rnd.nextInt(16)]}${hex[rnd.nextInt(16)]}\';',
       '}']);
  var code = functionName + '()';
  return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
};

Blockly.Dart['colour_rgb'] = function(block) {
  // Compose a colour from RGB components expressed as percentages.
  var red = Blockly.Dart.valueToCode(block, 'RED',
      Blockly.Dart.ORDER_NONE) || 0;
  var green = Blockly.Dart.valueToCode(block, 'GREEN',
      Blockly.Dart.ORDER_NONE) || 0;
  var blue = Blockly.Dart.valueToCode(block, 'BLUE',
      Blockly.Dart.ORDER_NONE) || 0;

  Blockly.Dart.definitions_['import_dart_math'] =
      'import \'dart:math\' as Math;';
  var functionName = Blockly.Dart.provideFunction_(
      'colour_rgb',
      ['String ' + Blockly.Dart.FUNCTION_NAME_PLACEHOLDER_ +
          '(num r, num g, num b) {',
       '  num rn = (Math.max(Math.min(r, 100), 0) * 2.55).round();',
       '  String rs = rn.toInt().toRadixString(16);',
       '  rs = \'0$rs\';',
       '  rs = rs.substring(rs.length - 2);',
       '  num gn = (Math.max(Math.min(g, 100), 0) * 2.55).round();',
       '  String gs = gn.toInt().toRadixString(16);',
       '  gs = \'0$gs\';',
       '  gs = gs.substring(gs.length - 2);',
       '  num bn = (Math.max(Math.min(b, 100), 0) * 2.55).round();',
       '  String bs = bn.toInt().toRadixString(16);',
       '  bs = \'0$bs\';',
       '  bs = bs.substring(bs.length - 2);',
       '  return \'#$rs$gs$bs\';',
       '}']);
  var code = functionName + '(' + red + ', ' + green + ', ' + blue + ')';
  return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
};

Blockly.Dart['colour_blend'] = function(block) {
  // Blend two colours together.
  var c1 = Blockly.Dart.valueToCode(block, 'COLOUR1',
      Blockly.Dart.ORDER_NONE) || '\'#000000\'';
  var c2 = Blockly.Dart.valueToCode(block, 'COLOUR2',
      Blockly.Dart.ORDER_NONE) || '\'#000000\'';
  var ratio = Blockly.Dart.valueToCode(block, 'RATIO',
      Blockly.Dart.ORDER_NONE) || 0.5;

  Blockly.Dart.definitions_['import_dart_math'] =
      'import \'dart:math\' as Math;';
  var functionName = Blockly.Dart.provideFunction_(
      'colour_blend',
      ['String ' + Blockly.Dart.FUNCTION_NAME_PLACEHOLDER_ +
          '(String c1, String c2, num ratio) {',
       '  ratio = Math.max(Math.min(ratio, 1), 0);',
       '  int r1 = int.parse(\'0x${c1.substring(1, 3)}\');',
       '  int g1 = int.parse(\'0x${c1.substring(3, 5)}\');',
       '  int b1 = int.parse(\'0x${c1.substring(5, 7)}\');',
       '  int r2 = int.parse(\'0x${c2.substring(1, 3)}\');',
       '  int g2 = int.parse(\'0x${c2.substring(3, 5)}\');',
       '  int b2 = int.parse(\'0x${c2.substring(5, 7)}\');',
       '  num rn = (r1 * (1 - ratio) + r2 * ratio).round();',
       '  String rs = rn.toInt().toRadixString(16);',
       '  num gn = (g1 * (1 - ratio) + g2 * ratio).round();',
       '  String gs = gn.toInt().toRadixString(16);',
       '  num bn = (b1 * (1 - ratio) + b2 * ratio).round();',
       '  String bs = bn.toInt().toRadixString(16);',
       '  rs = \'0$rs\';',
       '  rs = rs.substring(rs.length - 2);',
       '  gs = \'0$gs\';',
       '  gs = gs.substring(gs.length - 2);',
       '  bs = \'0$bs\';',
       '  bs = bs.substring(bs.length - 2);',
       '  return \'#$rs$gs$bs\';',
       '}']);
  var code = functionName + '(' + c1 + ', ' + c2 + ', ' + ratio + ')';
  return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
};
/**
 * @license
 * Copyright 2014 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Generating Dart for list blocks.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

goog.provide('Blockly.Dart.lists');

goog.require('Blockly.Dart');


Blockly.Dart.addReservedWords('Math');

Blockly.Dart['lists_create_empty'] = function(block) {
  // Create an empty list.
  return ['[]', Blockly.Dart.ORDER_ATOMIC];
};

Blockly.Dart['lists_create_with'] = function(block) {
  // Create a list with any number of elements of any type.
  var elements = new Array(block.itemCount_);
  for (var i = 0; i < block.itemCount_; i++) {
    elements[i] = Blockly.Dart.valueToCode(block, 'ADD' + i,
        Blockly.Dart.ORDER_NONE) || 'null';
  }
  var code = '[' + elements.join(', ') + ']';
  return [code, Blockly.Dart.ORDER_ATOMIC];
};

Blockly.Dart['lists_repeat'] = function(block) {
  // Create a list with one element repeated.
  var element = Blockly.Dart.valueToCode(block, 'ITEM',
      Blockly.Dart.ORDER_NONE) || 'null';
  var repeatCount = Blockly.Dart.valueToCode(block, 'NUM',
      Blockly.Dart.ORDER_NONE) || '0';
  var code = 'new List.filled(' + repeatCount + ', ' + element + ')';
  return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
};

Blockly.Dart['lists_length'] = function(block) {
  // String or array length.
  var list = Blockly.Dart.valueToCode(block, 'VALUE',
      Blockly.Dart.ORDER_UNARY_POSTFIX) || '[]';
  return [list + '.length', Blockly.Dart.ORDER_UNARY_POSTFIX];
};

Blockly.Dart['lists_isEmpty'] = function(block) {
  // Is the string null or array empty?
  var list = Blockly.Dart.valueToCode(block, 'VALUE',
      Blockly.Dart.ORDER_UNARY_POSTFIX) || '[]';
  return [list + '.isEmpty', Blockly.Dart.ORDER_UNARY_POSTFIX];
};

Blockly.Dart['lists_indexOf'] = function(block) {
  // Find an item in the list.
  var operator = block.getFieldValue('END') == 'FIRST' ?
      'indexOf' : 'lastIndexOf';
  var item = Blockly.Dart.valueToCode(block, 'FIND',
      Blockly.Dart.ORDER_NONE) || '\'\'';
  var list = Blockly.Dart.valueToCode(block, 'VALUE',
      Blockly.Dart.ORDER_UNARY_POSTFIX) || '[]';
  var code = list + '.' + operator + '(' + item + ')';
  if (block.workspace.options.oneBasedIndex) {
    return [code + ' + 1', Blockly.Dart.ORDER_ADDITIVE];
  }
  return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
};

Blockly.Dart['lists_getIndex'] = function(block) {
  // Get element at index.
  // Note: Until January 2013 this block did not have MODE or WHERE inputs.
  var mode = block.getFieldValue('MODE') || 'GET';
  var where = block.getFieldValue('WHERE') || 'FROM_START';
  var listOrder = (where == 'RANDOM' || where == 'FROM_END') ?
      Blockly.Dart.ORDER_NONE : Blockly.Dart.ORDER_UNARY_POSTFIX;
  var list = Blockly.Dart.valueToCode(block, 'VALUE', listOrder) || '[]';
  // Cache non-trivial values to variables to prevent repeated look-ups.
  // Closure, which accesses and modifies 'list'.
  function cacheList() {
    var listVar = Blockly.Dart.variableDB_.getDistinctName(
        'tmp_list', Blockly.VARIABLE_CATEGORY_NAME);
    var code = 'List ' + listVar + ' = ' + list + ';\n';
    list = listVar;
    return code;
  }
  // If `list` would be evaluated more than once (which is the case for
  // RANDOM REMOVE and FROM_END) and is non-trivial, make sure to access it
  // only once.
  if (((where == 'RANDOM' && mode == 'REMOVE') || where == 'FROM_END') &&
      !list.match(/^\w+$/)) {
    // `list` is an expression, so we may not evaluate it more than once.
    if (where == 'RANDOM') {
      Blockly.Dart.definitions_['import_dart_math'] =
          'import \'dart:math\' as Math;';
      // We can use multiple statements.
      var code = cacheList();
      var xVar = Blockly.Dart.variableDB_.getDistinctName(
          'tmp_x', Blockly.VARIABLE_CATEGORY_NAME);
      code += 'int ' + xVar + ' = new Math.Random().nextInt(' + list +
          '.length);\n';
      code += list + '.removeAt(' + xVar + ');\n';
      return code;
    } else {  // where == 'FROM_END'
      if (mode == 'REMOVE') {
        // We can use multiple statements.
        var at = Blockly.Dart.getAdjusted(block, 'AT', 1, false,
            Blockly.Dart.ORDER_ADDITIVE);
        var code = cacheList();
        code += list + '.removeAt(' + list + '.length' + ' - ' + at + ');\n';
        return code;

      } else if (mode == 'GET') {
        var at = Blockly.Dart.getAdjusted(block, 'AT', 1);
        // We need to create a procedure to avoid reevaluating values.
        var functionName = Blockly.Dart.provideFunction_(
            'lists_get_from_end',
            ['dynamic ' + Blockly.Dart.FUNCTION_NAME_PLACEHOLDER_ +
            '(List my_list, num x) {',
              '  x = my_list.length - x;',
              '  return my_list[x];',
              '}']);
        var code = functionName + '(' + list + ', ' + at + ')';
        return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
      } else if (mode == 'GET_REMOVE') {
        var at = Blockly.Dart.getAdjusted(block, 'AT', 1);
        // We need to create a procedure to avoid reevaluating values.
        var functionName = Blockly.Dart.provideFunction_(
            'lists_remove_from_end',
            ['dynamic ' + Blockly.Dart.FUNCTION_NAME_PLACEHOLDER_ +
            '(List my_list, num x) {',
              '  x = my_list.length - x;',
              '  return my_list.removeAt(x);',
              '}']);
        var code = functionName + '(' + list + ', ' + at + ')';
        return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
      }
    }
  } else {
    // Either `list` is a simple variable, or we only need to refer to `list`
    // once.
    switch (where) {
      case 'FIRST':
        if (mode == 'GET') {
          var code = list + '.first';
          return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
        } else if (mode == 'GET_REMOVE') {
          var code = list + '.removeAt(0)';
          return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
        } else if (mode == 'REMOVE') {
          return list + '.removeAt(0);\n';
        }
        break;
      case 'LAST':
        if (mode == 'GET') {
          var code = list + '.last';
          return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
        } else if (mode == 'GET_REMOVE') {
          var code = list + '.removeLast()';
          return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
        } else if (mode == 'REMOVE') {
          return list + '.removeLast();\n';
        }
        break;
      case 'FROM_START':
        var at = Blockly.Dart.getAdjusted(block, 'AT');
        if (mode == 'GET') {
          var code = list + '[' + at + ']';
          return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
        } else if (mode == 'GET_REMOVE') {
          var code = list + '.removeAt(' + at + ')';
          return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
        } else if (mode == 'REMOVE') {
          return list + '.removeAt(' + at + ');\n';
        }
        break;
      case 'FROM_END':
        var at = Blockly.Dart.getAdjusted(block, 'AT', 1, false,
            Blockly.Dart.ORDER_ADDITIVE);
        if (mode == 'GET') {
          var code = list + '[' + list + '.length - ' + at + ']';
          return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
        } else if (mode == 'GET_REMOVE' || mode == 'REMOVE') {
          var code = list + '.removeAt(' + list + '.length - ' + at + ')';
          if (mode == 'GET_REMOVE') {
            return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
          } else if (mode == 'REMOVE') {
            return code + ';\n';
          }
        }
        break;
      case 'RANDOM':
        Blockly.Dart.definitions_['import_dart_math'] =
            'import \'dart:math\' as Math;';
        if (mode == 'REMOVE') {
          // We can use multiple statements.
          var xVar = Blockly.Dart.variableDB_.getDistinctName(
              'tmp_x', Blockly.VARIABLE_CATEGORY_NAME);
          var code = 'int ' + xVar + ' = new Math.Random().nextInt(' + list +
              '.length);\n';
          code += list + '.removeAt(' + xVar + ');\n';
          return code;
        } else if (mode == 'GET') {
          var functionName = Blockly.Dart.provideFunction_(
              'lists_get_random_item',
              ['dynamic ' + Blockly.Dart.FUNCTION_NAME_PLACEHOLDER_ +
              '(List my_list) {',
                '  int x = new Math.Random().nextInt(my_list.length);',
                '  return my_list[x];',
                '}']);
          var code = functionName + '(' + list + ')';
          return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
        } else if (mode == 'GET_REMOVE') {
          var functionName = Blockly.Dart.provideFunction_(
              'lists_remove_random_item',
              ['dynamic ' + Blockly.Dart.FUNCTION_NAME_PLACEHOLDER_ +
              '(List my_list) {',
                '  int x = new Math.Random().nextInt(my_list.length);',
                '  return my_list.removeAt(x);',
                '}']);
          var code = functionName + '(' + list + ')';
          return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
        }
        break;
    }
  }
  throw Error('Unhandled combination (lists_getIndex).');
};

Blockly.Dart['lists_setIndex'] = function(block) {
  // Set element at index.
  // Note: Until February 2013 this block did not have MODE or WHERE inputs.
  var mode = block.getFieldValue('MODE') || 'GET';
  var where = block.getFieldValue('WHERE') || 'FROM_START';
  var list = Blockly.Dart.valueToCode(block, 'LIST',
      Blockly.Dart.ORDER_UNARY_POSTFIX) || '[]';
  var value = Blockly.Dart.valueToCode(block, 'TO',
      Blockly.Dart.ORDER_ASSIGNMENT) || 'null';
  // Cache non-trivial values to variables to prevent repeated look-ups.
  // Closure, which accesses and modifies 'list'.
  function cacheList() {
    if (list.match(/^\w+$/)) {
      return '';
    }
    var listVar = Blockly.Dart.variableDB_.getDistinctName(
        'tmp_list', Blockly.VARIABLE_CATEGORY_NAME);
    var code = 'List ' + listVar + ' = ' + list + ';\n';
    list = listVar;
    return code;
  }
  switch (where) {
    case 'FIRST':
      if (mode == 'SET') {
        return list + '[0] = ' + value + ';\n';
      } else if (mode == 'INSERT') {
        return list + '.insert(0, ' + value + ');\n';
      }
      break;
    case 'LAST':
      if (mode == 'SET') {
        var code = cacheList();
        code += list + '[' + list + '.length - 1] = ' + value + ';\n';
        return code;
      } else if (mode == 'INSERT') {
        return list + '.add(' + value + ');\n';
      }
      break;
    case 'FROM_START':
      var at = Blockly.Dart.getAdjusted(block, 'AT');
      if (mode == 'SET') {
        return list + '[' + at + '] = ' + value + ';\n';
      } else if (mode == 'INSERT') {
        return list + '.insert(' + at + ', ' + value + ');\n';
      }
      break;
    case 'FROM_END':
      var at = Blockly.Dart.getAdjusted(block, 'AT', 1, false,
          Blockly.Dart.ORDER_ADDITIVE);
      var code = cacheList();
      if (mode == 'SET') {
        code += list + '[' + list + '.length - ' + at + '] = ' + value +
            ';\n';
        return code;
      } else if (mode == 'INSERT') {
        code += list + '.insert(' + list + '.length - ' + at + ', ' +
            value + ');\n';
        return code;
      }
      break;
    case 'RANDOM':
      Blockly.Dart.definitions_['import_dart_math'] =
          'import \'dart:math\' as Math;';
      var code = cacheList();
      var xVar = Blockly.Dart.variableDB_.getDistinctName(
          'tmp_x', Blockly.VARIABLE_CATEGORY_NAME);
      code += 'int ' + xVar +
          ' = new Math.Random().nextInt(' + list + '.length);\n';
      if (mode == 'SET') {
        code += list + '[' + xVar + '] = ' + value + ';\n';
        return code;
      } else if (mode == 'INSERT') {
        code += list + '.insert(' + xVar + ', ' + value + ');\n';
        return code;
      }
      break;
  }
  throw Error('Unhandled combination (lists_setIndex).');
};

Blockly.Dart['lists_getSublist'] = function(block) {
  // Get sublist.
  var list = Blockly.Dart.valueToCode(block, 'LIST',
      Blockly.Dart.ORDER_UNARY_POSTFIX) || '[]';
  var where1 = block.getFieldValue('WHERE1');
  var where2 = block.getFieldValue('WHERE2');
  if (list.match(/^\w+$/) || (where1 != 'FROM_END' && where2 == 'FROM_START')) {
    // If the list is a is a variable or doesn't require a call for length,
    // don't generate a helper function.
    switch (where1) {
      case 'FROM_START':
        var at1 = Blockly.Dart.getAdjusted(block, 'AT1');
        break;
      case 'FROM_END':
        var at1 = Blockly.Dart.getAdjusted(block, 'AT1', 1, false,
            Blockly.Dart.ORDER_ADDITIVE);
        at1 = list + '.length - ' + at1;
        break;
      case 'FIRST':
        var at1 = '0';
        break;
      default:
        throw Error('Unhandled option (lists_getSublist).');
    }
    switch (where2) {
      case 'FROM_START':
        var at2 = Blockly.Dart.getAdjusted(block, 'AT2', 1);
        break;
      case 'FROM_END':
        var at2 = Blockly.Dart.getAdjusted(block, 'AT2', 0, false,
            Blockly.Dart.ORDER_ADDITIVE);
        at2 = list + '.length - ' + at2;
        break;
      case 'LAST':
        // There is no second index if LAST option is chosen.
        break;
      default:
        throw Error('Unhandled option (lists_getSublist).');
    }
    if (where2 == 'LAST') {
      var code = list + '.sublist(' + at1 + ')';
    } else {
      var code = list + '.sublist(' + at1 + ', ' + at2 + ')';
    }
  } else {
    var at1 = Blockly.Dart.getAdjusted(block, 'AT1');
    var at2 = Blockly.Dart.getAdjusted(block, 'AT2');
    var functionName = Blockly.Dart.provideFunction_(
        'lists_get_sublist',
        ['List ' + Blockly.Dart.FUNCTION_NAME_PLACEHOLDER_ +
            '(List list, String where1, num at1, String where2, num at2) {',
         '  int getAt(String where, num at) {',
         '    if (where == \'FROM_END\') {',
         '      at = list.length - 1 - at;',
         '    } else if (where == \'FIRST\') {',
         '      at = 0;',
         '    } else if (where == \'LAST\') {',
         '      at = list.length - 1;',
         '    } else if (where != \'FROM_START\') {',
         '      throw \'Unhandled option (lists_getSublist).\';',
         '    }',
         '    return at;',
         '  }',
         '  at1 = getAt(where1, at1);',
         '  at2 = getAt(where2, at2) + 1;',
         '  return list.sublist(at1, at2);',
         '}']);
    var code = functionName + '(' + list + ', \'' +
        where1 + '\', ' + at1 + ', \'' + where2 + '\', ' + at2 + ')';
  }
  return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
};

Blockly.Dart['lists_sort'] = function(block) {
  // Block for sorting a list.
  var list = Blockly.Dart.valueToCode(block, 'LIST',
      Blockly.Dart.ORDER_NONE) || '[]';
  var direction = block.getFieldValue('DIRECTION') === '1' ? 1 : -1;
  var type = block.getFieldValue('TYPE');
  var sortFunctionName = Blockly.Dart.provideFunction_(
      'lists_sort',
      ['List ' + Blockly.Dart.FUNCTION_NAME_PLACEHOLDER_ +
          '(List list, String type, int direction) {',
       '  var compareFuncs = {',
       '    "NUMERIC": (a, b) => (direction * a.compareTo(b)).toInt(),',
       '    "TEXT": (a, b) => direction * ' +
          'a.toString().compareTo(b.toString()),',
       '    "IGNORE_CASE": ',
       '       (a, b) => direction * ',
       '      a.toString().toLowerCase().compareTo(b.toString().toLowerCase())',
       '  };',
       '  list = new List.from(list);', // Clone the list.
       '  var compare = compareFuncs[type];',
       '  list.sort(compare);',
       '  return list;',
       '}']);
  return [sortFunctionName + '(' + list + ', ' +
      '"' + type + '", ' + direction + ')',
      Blockly.Dart.ORDER_UNARY_POSTFIX];
};

Blockly.Dart['lists_split'] = function(block) {
  // Block for splitting text into a list, or joining a list into text.
  var input = Blockly.Dart.valueToCode(block, 'INPUT',
      Blockly.Dart.ORDER_UNARY_POSTFIX);
  var delimiter = Blockly.Dart.valueToCode(block, 'DELIM',
      Blockly.Dart.ORDER_NONE) || '\'\'';
  var mode = block.getFieldValue('MODE');
  if (mode == 'SPLIT') {
    if (!input) {
      input = '\'\'';
    }
    var functionName = 'split';
  } else if (mode == 'JOIN') {
    if (!input) {
      input = '[]';
    }
    var functionName = 'join';
  } else {
    throw Error('Unknown mode: ' + mode);
  }
  var code = input + '.' + functionName + '(' + delimiter + ')';
  return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
};

Blockly.Dart['lists_reverse'] = function(block) {
  // Block for reversing a list.
  var list = Blockly.Dart.valueToCode(block, 'LIST',
      Blockly.Dart.ORDER_NONE) || '[]';
  // XXX What should the operator precedence be for a `new`?
  var code = 'new List.from(' + list + '.reversed)';
  return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
};
/**
 * @license
 * Copyright 2014 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Generating Dart for logic blocks.
 * @author q.neutron@gmail.com (Quynh Neutron)
 */
'use strict';

goog.provide('Blockly.Dart.logic');

goog.require('Blockly.Dart');


Blockly.Dart['controls_if'] = function(block) {
  // If/elseif/else condition.
  var n = 0;
  var code = '', branchCode, conditionCode;
  if (Blockly.Dart.STATEMENT_PREFIX) {
    // Automatic prefix insertion is switched off for this block.  Add manually.
    code += Blockly.Dart.injectId(Blockly.Dart.STATEMENT_PREFIX, block);
  }
  do {
    conditionCode = Blockly.Dart.valueToCode(block, 'IF' + n,
        Blockly.Dart.ORDER_NONE) || 'false';
    branchCode = Blockly.Dart.statementToCode(block, 'DO' + n);
    if (Blockly.Dart.STATEMENT_SUFFIX) {
      branchCode = Blockly.Dart.prefixLines(
          Blockly.Dart.injectId(Blockly.Dart.STATEMENT_SUFFIX, block),
          Blockly.Dart.INDENT) + branchCode;
    }
    code += (n > 0 ? 'else ' : '') +
        'if (' + conditionCode + ') {\n' + branchCode + '}';
    ++n;
  } while (block.getInput('IF' + n));

  if (block.getInput('ELSE') || Blockly.Dart.STATEMENT_SUFFIX) {
    branchCode = Blockly.Dart.statementToCode(block, 'ELSE');
    if (Blockly.Dart.STATEMENT_SUFFIX) {
      branchCode = Blockly.Dart.prefixLines(
          Blockly.Dart.injectId(Blockly.Dart.STATEMENT_SUFFIX, block),
          Blockly.Dart.INDENT) + branchCode;
    }
    code += ' else {\n' + branchCode + '}';
  }
  return code + '\n';
};

Blockly.Dart['controls_ifelse'] = Blockly.Dart['controls_if'];

Blockly.Dart['logic_compare'] = function(block) {
  // Comparison operator.
  var OPERATORS = {
    'EQ': '==',
    'NEQ': '!=',
    'LT': '<',
    'LTE': '<=',
    'GT': '>',
    'GTE': '>='
  };
  var operator = OPERATORS[block.getFieldValue('OP')];
  var order = (operator == '==' || operator == '!=') ?
      Blockly.Dart.ORDER_EQUALITY : Blockly.Dart.ORDER_RELATIONAL;
  var argument0 = Blockly.Dart.valueToCode(block, 'A', order) || '0';
  var argument1 = Blockly.Dart.valueToCode(block, 'B', order) || '0';
  var code = argument0 + ' ' + operator + ' ' + argument1;
  return [code, order];
};

Blockly.Dart['logic_operation'] = function(block) {
  // Operations 'and', 'or'.
  var operator = (block.getFieldValue('OP') == 'AND') ? '&&' : '||';
  var order = (operator == '&&') ? Blockly.Dart.ORDER_LOGICAL_AND :
      Blockly.Dart.ORDER_LOGICAL_OR;
  var argument0 = Blockly.Dart.valueToCode(block, 'A', order);
  var argument1 = Blockly.Dart.valueToCode(block, 'B', order);
  if (!argument0 && !argument1) {
    // If there are no arguments, then the return value is false.
    argument0 = 'false';
    argument1 = 'false';
  } else {
    // Single missing arguments have no effect on the return value.
    var defaultArgument = (operator == '&&') ? 'true' : 'false';
    if (!argument0) {
      argument0 = defaultArgument;
    }
    if (!argument1) {
      argument1 = defaultArgument;
    }
  }
  var code = argument0 + ' ' + operator + ' ' + argument1;
  return [code, order];
};

Blockly.Dart['logic_negate'] = function(block) {
  // Negation.
  var order = Blockly.Dart.ORDER_UNARY_PREFIX;
  var argument0 = Blockly.Dart.valueToCode(block, 'BOOL', order) || 'true';
  var code = '!' + argument0;
  return [code, order];
};

Blockly.Dart['logic_boolean'] = function(block) {
  // Boolean values true and false.
  var code = (block.getFieldValue('BOOL') == 'TRUE') ? 'true' : 'false';
  return [code, Blockly.Dart.ORDER_ATOMIC];
};

Blockly.Dart['logic_null'] = function(block) {
  // Null data type.
  return ['null', Blockly.Dart.ORDER_ATOMIC];
};

Blockly.Dart['logic_ternary'] = function(block) {
  // Ternary operator.
  var value_if = Blockly.Dart.valueToCode(block, 'IF',
      Blockly.Dart.ORDER_CONDITIONAL) || 'false';
  var value_then = Blockly.Dart.valueToCode(block, 'THEN',
      Blockly.Dart.ORDER_CONDITIONAL) || 'null';
  var value_else = Blockly.Dart.valueToCode(block, 'ELSE',
      Blockly.Dart.ORDER_CONDITIONAL) || 'null';
  var code = value_if + ' ? ' + value_then + ' : ' + value_else;
  return [code, Blockly.Dart.ORDER_CONDITIONAL];
};
/**
 * @license
 * Copyright 2014 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Generating Dart for loop blocks.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

goog.provide('Blockly.Dart.loops');

goog.require('Blockly.Dart');


Blockly.Dart['controls_repeat_ext'] = function(block) {
  // Repeat n times.
  if (block.getField('TIMES')) {
    // Internal number.
    var repeats = String(Number(block.getFieldValue('TIMES')));
  } else {
    // External number.
    var repeats = Blockly.Dart.valueToCode(block, 'TIMES',
        Blockly.Dart.ORDER_ASSIGNMENT) || '0';
  }
  var branch = Blockly.Dart.statementToCode(block, 'DO');
  branch = Blockly.Dart.addLoopTrap(branch, block);
  var code = '';
  var loopVar = Blockly.Dart.variableDB_.getDistinctName(
      'count', Blockly.VARIABLE_CATEGORY_NAME);
  var endVar = repeats;
  if (!repeats.match(/^\w+$/) && !Blockly.isNumber(repeats)) {
    endVar = Blockly.Dart.variableDB_.getDistinctName(
        'repeat_end', Blockly.VARIABLE_CATEGORY_NAME);
    code += 'var ' + endVar + ' = ' + repeats + ';\n';
  }
  code += 'for (int ' + loopVar + ' = 0; ' +
      loopVar + ' < ' + endVar + '; ' +
      loopVar + '++) {\n' +
      branch + '}\n';
  return code;
};

Blockly.Dart['controls_repeat'] = Blockly.Dart['controls_repeat_ext'];

Blockly.Dart['controls_whileUntil'] = function(block) {
  // Do while/until loop.
  var until = block.getFieldValue('MODE') == 'UNTIL';
  var argument0 = Blockly.Dart.valueToCode(block, 'BOOL',
      until ? Blockly.Dart.ORDER_UNARY_PREFIX :
      Blockly.Dart.ORDER_NONE) || 'false';
  var branch = Blockly.Dart.statementToCode(block, 'DO');
  branch = Blockly.Dart.addLoopTrap(branch, block);
  if (until) {
    argument0 = '!' + argument0;
  }
  return 'while (' + argument0 + ') {\n' + branch + '}\n';
};

Blockly.Dart['controls_for'] = function(block) {
  // For loop.
  var variable0 = Blockly.Dart.variableDB_.getName(
      block.getFieldValue('VAR'), Blockly.VARIABLE_CATEGORY_NAME);
  var argument0 = Blockly.Dart.valueToCode(block, 'FROM',
      Blockly.Dart.ORDER_ASSIGNMENT) || '0';
  var argument1 = Blockly.Dart.valueToCode(block, 'TO',
      Blockly.Dart.ORDER_ASSIGNMENT) || '0';
  var increment = Blockly.Dart.valueToCode(block, 'BY',
      Blockly.Dart.ORDER_ASSIGNMENT) || '1';
  var branch = Blockly.Dart.statementToCode(block, 'DO');
  branch = Blockly.Dart.addLoopTrap(branch, block);
  var code;
  if (Blockly.isNumber(argument0) && Blockly.isNumber(argument1) &&
      Blockly.isNumber(increment)) {
    // All arguments are simple numbers.
    var up = Number(argument0) <= Number(argument1);
    code = 'for (' + variable0 + ' = ' + argument0 + '; ' +
        variable0 + (up ? ' <= ' : ' >= ') + argument1 + '; ' +
        variable0;
    var step = Math.abs(Number(increment));
    if (step == 1) {
      code += up ? '++' : '--';
    } else {
      code += (up ? ' += ' : ' -= ') + step;
    }
    code += ') {\n' + branch + '}\n';
  } else {
    code = '';
    // Cache non-trivial values to variables to prevent repeated look-ups.
    var startVar = argument0;
    if (!argument0.match(/^\w+$/) && !Blockly.isNumber(argument0)) {
      startVar = Blockly.Dart.variableDB_.getDistinctName(
          variable0 + '_start', Blockly.VARIABLE_CATEGORY_NAME);
      code += 'var ' + startVar + ' = ' + argument0 + ';\n';
    }
    var endVar = argument1;
    if (!argument1.match(/^\w+$/) && !Blockly.isNumber(argument1)) {
      endVar = Blockly.Dart.variableDB_.getDistinctName(
          variable0 + '_end', Blockly.VARIABLE_CATEGORY_NAME);
      code += 'var ' + endVar + ' = ' + argument1 + ';\n';
    }
    // Determine loop direction at start, in case one of the bounds
    // changes during loop execution.
    var incVar = Blockly.Dart.variableDB_.getDistinctName(
        variable0 + '_inc', Blockly.VARIABLE_CATEGORY_NAME);
    code += 'num ' + incVar + ' = ';
    if (Blockly.isNumber(increment)) {
      code += Math.abs(increment) + ';\n';
    } else {
      code += '(' + increment + ').abs();\n';
    }
    code += 'if (' + startVar + ' > ' + endVar + ') {\n';
    code += Blockly.Dart.INDENT + incVar + ' = -' + incVar + ';\n';
    code += '}\n';
    code += 'for (' + variable0 + ' = ' + startVar + '; ' +
        incVar + ' >= 0 ? ' +
        variable0 + ' <= ' + endVar + ' : ' +
        variable0 + ' >= ' + endVar + '; ' +
        variable0 + ' += ' + incVar + ') {\n' +
        branch + '}\n';
  }
  return code;
};

Blockly.Dart['controls_forEach'] = function(block) {
  // For each loop.
  var variable0 = Blockly.Dart.variableDB_.getName(
      block.getFieldValue('VAR'), Blockly.VARIABLE_CATEGORY_NAME);
  var argument0 = Blockly.Dart.valueToCode(block, 'LIST',
      Blockly.Dart.ORDER_ASSIGNMENT) || '[]';
  var branch = Blockly.Dart.statementToCode(block, 'DO');
  branch = Blockly.Dart.addLoopTrap(branch, block);
  var code = 'for (var ' + variable0 + ' in ' + argument0 + ') {\n' +
      branch + '}\n';
  return code;
};

Blockly.Dart['controls_flow_statements'] = function(block) {
  // Flow statements: continue, break.
  var xfix = '';
  if (Blockly.Dart.STATEMENT_PREFIX) {
    // Automatic prefix insertion is switched off for this block.  Add manually.
    xfix += Blockly.Dart.injectId(Blockly.Dart.STATEMENT_PREFIX, block);
  }
  if (Blockly.Dart.STATEMENT_SUFFIX) {
    // Inject any statement suffix here since the regular one at the end
    // will not get executed if the break/continue is triggered.
    xfix += Blockly.Dart.injectId(Blockly.Dart.STATEMENT_SUFFIX, block);
  }
  if (Blockly.Dart.STATEMENT_PREFIX) {
    var loop = Blockly.Constants.Loops
        .CONTROL_FLOW_IN_LOOP_CHECK_MIXIN.getSurroundLoop(block);
    if (loop && !loop.suppressPrefixSuffix) {
      // Inject loop's statement prefix here since the regular one at the end
      // of the loop will not get executed if 'continue' is triggered.
      // In the case of 'break', a prefix is needed due to the loop's suffix.
      xfix += Blockly.Dart.injectId(Blockly.Dart.STATEMENT_PREFIX, loop);
    }
  }
  switch (block.getFieldValue('FLOW')) {
    case 'BREAK':
      return xfix + 'break;\n';
    case 'CONTINUE':
      return xfix + 'continue;\n';
  }
  throw Error('Unknown flow statement.');
};
/**
 * @license
 * Copyright 2014 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Generating Dart for math blocks.
 * @author q.neutron@gmail.com (Quynh Neutron)
 */
'use strict';

goog.provide('Blockly.Dart.math');

goog.require('Blockly.Dart');


Blockly.Dart.addReservedWords('Math');

Blockly.Dart['math_number'] = function(block) {
  // Numeric value.
  var code = Number(block.getFieldValue('NUM'));
  var order;
  if (code == Infinity) {
    code = 'double.infinity';
    order = Blockly.Dart.ORDER_UNARY_POSTFIX;
  } else if (code == -Infinity) {
    code = '-double.infinity';
    order = Blockly.Dart.ORDER_UNARY_PREFIX;
  } else {
    // -4.abs() returns -4 in Dart due to strange order of operation choices.
    // -4 is actually an operator and a number.  Reflect this in the order.
    order = code < 0 ?
        Blockly.Dart.ORDER_UNARY_PREFIX : Blockly.Dart.ORDER_ATOMIC;
  }
  return [code, order];
};

Blockly.Dart['math_arithmetic'] = function(block) {
  // Basic arithmetic operators, and power.
  var OPERATORS = {
    'ADD': [' + ', Blockly.Dart.ORDER_ADDITIVE],
    'MINUS': [' - ', Blockly.Dart.ORDER_ADDITIVE],
    'MULTIPLY': [' * ', Blockly.Dart.ORDER_MULTIPLICATIVE],
    'DIVIDE': [' / ', Blockly.Dart.ORDER_MULTIPLICATIVE],
    'POWER': [null, Blockly.Dart.ORDER_NONE]  // Handle power separately.
  };
  var tuple = OPERATORS[block.getFieldValue('OP')];
  var operator = tuple[0];
  var order = tuple[1];
  var argument0 = Blockly.Dart.valueToCode(block, 'A', order) || '0';
  var argument1 = Blockly.Dart.valueToCode(block, 'B', order) || '0';
  var code;
  // Power in Dart requires a special case since it has no operator.
  if (!operator) {
    Blockly.Dart.definitions_['import_dart_math'] =
        'import \'dart:math\' as Math;';
    code = 'Math.pow(' + argument0 + ', ' + argument1 + ')';
    return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
  }
  code = argument0 + operator + argument1;
  return [code, order];
};

Blockly.Dart['math_single'] = function(block) {
  // Math operators with single operand.
  var operator = block.getFieldValue('OP');
  var code;
  var arg;
  if (operator == 'NEG') {
    // Negation is a special case given its different operator precedence.
    arg = Blockly.Dart.valueToCode(block, 'NUM',
        Blockly.Dart.ORDER_UNARY_PREFIX) || '0';
    if (arg[0] == '-') {
      // --3 is not legal in Dart.
      arg = ' ' + arg;
    }
    code = '-' + arg;
    return [code, Blockly.Dart.ORDER_UNARY_PREFIX];
  }
  Blockly.Dart.definitions_['import_dart_math'] =
      'import \'dart:math\' as Math;';
  if (operator == 'ABS' || operator.substring(0, 5) == 'ROUND') {
    arg = Blockly.Dart.valueToCode(block, 'NUM',
        Blockly.Dart.ORDER_UNARY_POSTFIX) || '0';
  } else if (operator == 'SIN' || operator == 'COS' || operator == 'TAN') {
    arg = Blockly.Dart.valueToCode(block, 'NUM',
        Blockly.Dart.ORDER_MULTIPLICATIVE) || '0';
  } else {
    arg = Blockly.Dart.valueToCode(block, 'NUM',
        Blockly.Dart.ORDER_NONE) || '0';
  }
  // First, handle cases which generate values that don't need parentheses
  // wrapping the code.
  switch (operator) {
    case 'ABS':
      code = arg + '.abs()';
      break;
    case 'ROOT':
      code = 'Math.sqrt(' + arg + ')';
      break;
    case 'LN':
      code = 'Math.log(' + arg + ')';
      break;
    case 'EXP':
      code = 'Math.exp(' + arg + ')';
      break;
    case 'POW10':
      code = 'Math.pow(10,' + arg + ')';
      break;
    case 'ROUND':
      code = arg + '.round()';
      break;
    case 'ROUNDUP':
      code = arg + '.ceil()';
      break;
    case 'ROUNDDOWN':
      code = arg + '.floor()';
      break;
    case 'SIN':
      code = 'Math.sin(' + arg + ' / 180 * Math.pi)';
      break;
    case 'COS':
      code = 'Math.cos(' + arg + ' / 180 * Math.pi)';
      break;
    case 'TAN':
      code = 'Math.tan(' + arg + ' / 180 * Math.pi)';
      break;
  }
  if (code) {
    return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
  }
  // Second, handle cases which generate values that may need parentheses
  // wrapping the code.
  switch (operator) {
    case 'LOG10':
      code = 'Math.log(' + arg + ') / Math.log(10)';
      break;
    case 'ASIN':
      code = 'Math.asin(' + arg + ') / Math.pi * 180';
      break;
    case 'ACOS':
      code = 'Math.acos(' + arg + ') / Math.pi * 180';
      break;
    case 'ATAN':
      code = 'Math.atan(' + arg + ') / Math.pi * 180';
      break;
    default:
      throw Error('Unknown math operator: ' + operator);
  }
  return [code, Blockly.Dart.ORDER_MULTIPLICATIVE];
};

Blockly.Dart['math_constant'] = function(block) {
  // Constants: PI, E, the Golden Ratio, sqrt(2), 1/sqrt(2), INFINITY.
  var CONSTANTS = {
    'PI': ['Math.pi', Blockly.Dart.ORDER_UNARY_POSTFIX],
    'E': ['Math.e', Blockly.Dart.ORDER_UNARY_POSTFIX],
    'GOLDEN_RATIO':
        ['(1 + Math.sqrt(5)) / 2', Blockly.Dart.ORDER_MULTIPLICATIVE],
    'SQRT2': ['Math.sqrt2', Blockly.Dart.ORDER_UNARY_POSTFIX],
    'SQRT1_2': ['Math.sqrt1_2', Blockly.Dart.ORDER_UNARY_POSTFIX],
    'INFINITY': ['double.infinity', Blockly.Dart.ORDER_ATOMIC]
  };
  var constant = block.getFieldValue('CONSTANT');
  if (constant != 'INFINITY') {
    Blockly.Dart.definitions_['import_dart_math'] =
        'import \'dart:math\' as Math;';
  }
  return CONSTANTS[constant];
};

Blockly.Dart['math_number_property'] = function(block) {
  // Check if a number is even, odd, prime, whole, positive, or negative
  // or if it is divisible by certain number. Returns true or false.
  var number_to_check = Blockly.Dart.valueToCode(block, 'NUMBER_TO_CHECK',
      Blockly.Dart.ORDER_MULTIPLICATIVE);
  if (!number_to_check) {
    return ['false', Blockly.Dart.ORDER_ATOMIC];
  }
  var dropdown_property = block.getFieldValue('PROPERTY');
  var code;
  if (dropdown_property == 'PRIME') {
    // Prime is a special case as it is not a one-liner test.
    Blockly.Dart.definitions_['import_dart_math'] =
        'import \'dart:math\' as Math;';
    var functionName = Blockly.Dart.provideFunction_(
        'math_isPrime',
        ['bool ' + Blockly.Dart.FUNCTION_NAME_PLACEHOLDER_ + '(n) {',
         '  // https://en.wikipedia.org/wiki/Primality_test#Naive_methods',
         '  if (n == 2 || n == 3) {',
         '    return true;',
         '  }',
         '  // False if n is null, negative, is 1, or not whole.',
         '  // And false if n is divisible by 2 or 3.',
         '  if (n == null || n <= 1 || n % 1 != 0 || n % 2 == 0 ||' +
            ' n % 3 == 0) {',
         '    return false;',
         '  }',
         '  // Check all the numbers of form 6k +/- 1, up to sqrt(n).',
         '  for (var x = 6; x <= Math.sqrt(n) + 1; x += 6) {',
         '    if (n % (x - 1) == 0 || n % (x + 1) == 0) {',
         '      return false;',
         '    }',
         '  }',
         '  return true;',
         '}']);
    code = functionName + '(' + number_to_check + ')';
    return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
  }
  switch (dropdown_property) {
    case 'EVEN':
      code = number_to_check + ' % 2 == 0';
      break;
    case 'ODD':
      code = number_to_check + ' % 2 == 1';
      break;
    case 'WHOLE':
      code = number_to_check + ' % 1 == 0';
      break;
    case 'POSITIVE':
      code = number_to_check + ' > 0';
      break;
    case 'NEGATIVE':
      code = number_to_check + ' < 0';
      break;
    case 'DIVISIBLE_BY':
      var divisor = Blockly.Dart.valueToCode(block, 'DIVISOR',
          Blockly.Dart.ORDER_MULTIPLICATIVE);
      if (!divisor) {
        return ['false', Blockly.Dart.ORDER_ATOMIC];
      }
      code = number_to_check + ' % ' + divisor + ' == 0';
      break;
  }
  return [code, Blockly.Dart.ORDER_EQUALITY];
};

Blockly.Dart['math_change'] = function(block) {
  // Add to a variable in place.
  var argument0 = Blockly.Dart.valueToCode(block, 'DELTA',
      Blockly.Dart.ORDER_ADDITIVE) || '0';
  var varName = Blockly.Dart.variableDB_.getName(block.getFieldValue('VAR'),
      Blockly.VARIABLE_CATEGORY_NAME);
  return varName + ' = (' + varName + ' is num ? ' + varName + ' : 0) + ' +
      argument0 + ';\n';
};

// Rounding functions have a single operand.
Blockly.Dart['math_round'] = Blockly.Dart['math_single'];
// Trigonometry functions have a single operand.
Blockly.Dart['math_trig'] = Blockly.Dart['math_single'];

Blockly.Dart['math_on_list'] = function(block) {
  // Math functions for lists.
  var func = block.getFieldValue('OP');
  var list = Blockly.Dart.valueToCode(block, 'LIST',
      Blockly.Dart.ORDER_NONE) || '[]';
  var code;
  switch (func) {
    case 'SUM':
      var functionName = Blockly.Dart.provideFunction_(
          'math_sum',
          ['num ' + Blockly.Dart.FUNCTION_NAME_PLACEHOLDER_ +
              '(List<num> myList) {',
           '  num sumVal = 0;',
           '  myList.forEach((num entry) {sumVal += entry;});',
           '  return sumVal;',
           '}']);
      code = functionName + '(' + list + ')';
      break;
    case 'MIN':
      Blockly.Dart.definitions_['import_dart_math'] =
          'import \'dart:math\' as Math;';
      var functionName = Blockly.Dart.provideFunction_(
          'math_min',
          ['num ' + Blockly.Dart.FUNCTION_NAME_PLACEHOLDER_ +
              '(List<num> myList) {',
           '  if (myList.isEmpty) return null;',
           '  num minVal = myList[0];',
           '  myList.forEach((num entry) ' +
              '{minVal = Math.min(minVal, entry);});',
           '  return minVal;',
           '}']);
      code = functionName + '(' + list + ')';
      break;
    case 'MAX':
      Blockly.Dart.definitions_['import_dart_math'] =
          'import \'dart:math\' as Math;';
      var functionName = Blockly.Dart.provideFunction_(
          'math_max',
          ['num ' + Blockly.Dart.FUNCTION_NAME_PLACEHOLDER_ +
              '(List<num> myList) {',
           '  if (myList.isEmpty) return null;',
           '  num maxVal = myList[0];',
           '  myList.forEach((num entry) ' +
              '{maxVal = Math.max(maxVal, entry);});',
           '  return maxVal;',
           '}']);
      code = functionName + '(' + list + ')';
      break;
    case 'AVERAGE':
      // This operation exclude null and values that are not int or float:
      //   math_mean([null,null,"aString",1,9]) == 5.0.
      var functionName = Blockly.Dart.provideFunction_(
          'math_mean',
          ['num ' + Blockly.Dart.FUNCTION_NAME_PLACEHOLDER_ +
              '(List myList) {',
           '  // First filter list for numbers only.',
           '  List localList = new List.from(myList);',
           '  localList.removeWhere((a) => a is! num);',
           '  if (localList.isEmpty) return null;',
           '  num sumVal = 0;',
           '  localList.forEach((var entry) {sumVal += entry;});',
           '  return sumVal / localList.length;',
           '}']);
      code = functionName + '(' + list + ')';
      break;
    case 'MEDIAN':
      var functionName = Blockly.Dart.provideFunction_(
          'math_median',
          ['num ' + Blockly.Dart.FUNCTION_NAME_PLACEHOLDER_ +
              '(List myList) {',
           '  // First filter list for numbers only, then sort, ' +
              'then return middle value',
           '  // or the average of two middle values if list has an ' +
              'even number of elements.',
           '  List localList = new List.from(myList);',
           '  localList.removeWhere((a) => a is! num);',
           '  if (localList.isEmpty) return null;',
           '  localList.sort((a, b) => (a - b));',
           '  int index = localList.length ~/ 2;',
           '  if (localList.length % 2 == 1) {',
           '    return localList[index];',
           '  } else {',
           '    return (localList[index - 1] + localList[index]) / 2;',
           '  }',
           '}']);
      code = functionName + '(' + list + ')';
      break;
    case 'MODE':
      Blockly.Dart.definitions_['import_dart_math'] =
          'import \'dart:math\' as Math;';
      // As a list of numbers can contain more than one mode,
      // the returned result is provided as an array.
      // Mode of [3, 'x', 'x', 1, 1, 2, '3'] -> ['x', 1].
      var functionName = Blockly.Dart.provideFunction_(
          'math_modes',
          ['List ' + Blockly.Dart.FUNCTION_NAME_PLACEHOLDER_ +
              '(List values) {',
           '  List modes = [];',
           '  List counts = [];',
           '  int maxCount = 0;',
           '  for (int i = 0; i < values.length; i++) {',
           '    var value = values[i];',
           '    bool found = false;',
           '    int thisCount;',
           '    for (int j = 0; j < counts.length; j++) {',
           '      if (counts[j][0] == value) {',
           '        thisCount = ++counts[j][1];',
           '        found = true;',
           '        break;',
           '      }',
           '    }',
           '    if (!found) {',
           '      counts.add([value, 1]);',
           '      thisCount = 1;',
           '    }',
           '    maxCount = Math.max(thisCount, maxCount);',
           '  }',
           '  for (int j = 0; j < counts.length; j++) {',
           '    if (counts[j][1] == maxCount) {',
           '        modes.add(counts[j][0]);',
           '    }',
           '  }',
           '  return modes;',
           '}']);
      code = functionName + '(' + list + ')';
      break;
    case 'STD_DEV':
      Blockly.Dart.definitions_['import_dart_math'] =
          'import \'dart:math\' as Math;';
      var functionName = Blockly.Dart.provideFunction_(
          'math_standard_deviation',
          ['num ' + Blockly.Dart.FUNCTION_NAME_PLACEHOLDER_ +
              '(List myList) {',
           '  // First filter list for numbers only.',
           '  List numbers = new List.from(myList);',
           '  numbers.removeWhere((a) => a is! num);',
           '  if (numbers.isEmpty) return null;',
           '  num n = numbers.length;',
           '  num sum = 0;',
           '  numbers.forEach((x) => sum += x);',
           '  num mean = sum / n;',
           '  num sumSquare = 0;',
           '  numbers.forEach((x) => sumSquare += ' +
              'Math.pow(x - mean, 2));',
           '  return Math.sqrt(sumSquare / n);',
           '}']);
      code = functionName + '(' + list + ')';
      break;
    case 'RANDOM':
      Blockly.Dart.definitions_['import_dart_math'] =
          'import \'dart:math\' as Math;';
      var functionName = Blockly.Dart.provideFunction_(
          'math_random_item',
          ['dynamic ' + Blockly.Dart.FUNCTION_NAME_PLACEHOLDER_ +
              '(List myList) {',
           '  int x = new Math.Random().nextInt(myList.length);',
           '  return myList[x];',
           '}']);
      code = functionName + '(' + list + ')';
      break;
    default:
      throw Error('Unknown operator: ' + func);
  }
  return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
};

Blockly.Dart['math_modulo'] = function(block) {
  // Remainder computation.
  var argument0 = Blockly.Dart.valueToCode(block, 'DIVIDEND',
      Blockly.Dart.ORDER_MULTIPLICATIVE) || '0';
  var argument1 = Blockly.Dart.valueToCode(block, 'DIVISOR',
      Blockly.Dart.ORDER_MULTIPLICATIVE) || '0';
  var code = argument0 + ' % ' + argument1;
  return [code, Blockly.Dart.ORDER_MULTIPLICATIVE];
};

Blockly.Dart['math_constrain'] = function(block) {
  // Constrain a number between two limits.
  Blockly.Dart.definitions_['import_dart_math'] =
      'import \'dart:math\' as Math;';
  var argument0 = Blockly.Dart.valueToCode(block, 'VALUE',
      Blockly.Dart.ORDER_NONE) || '0';
  var argument1 = Blockly.Dart.valueToCode(block, 'LOW',
      Blockly.Dart.ORDER_NONE) || '0';
  var argument2 = Blockly.Dart.valueToCode(block, 'HIGH',
      Blockly.Dart.ORDER_NONE) || 'double.infinity';
  var code = 'Math.min(Math.max(' + argument0 + ', ' + argument1 + '), ' +
      argument2 + ')';
  return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
};

Blockly.Dart['math_random_int'] = function(block) {
  // Random integer between [X] and [Y].
  Blockly.Dart.definitions_['import_dart_math'] =
      'import \'dart:math\' as Math;';
  var argument0 = Blockly.Dart.valueToCode(block, 'FROM',
      Blockly.Dart.ORDER_NONE) || '0';
  var argument1 = Blockly.Dart.valueToCode(block, 'TO',
      Blockly.Dart.ORDER_NONE) || '0';
  var functionName = Blockly.Dart.provideFunction_(
      'math_random_int',
      ['int ' + Blockly.Dart.FUNCTION_NAME_PLACEHOLDER_ + '(num a, num b) {',
       '  if (a > b) {',
       '    // Swap a and b to ensure a is smaller.',
       '    num c = a;',
       '    a = b;',
       '    b = c;',
       '  }',
       '  return new Math.Random().nextInt(b - a + 1) + a;',
       '}']);
  var code = functionName + '(' + argument0 + ', ' + argument1 + ')';
  return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
};

Blockly.Dart['math_random_float'] = function(block) {
  // Random fraction between 0 and 1.
  Blockly.Dart.definitions_['import_dart_math'] =
      'import \'dart:math\' as Math;';
  return ['new Math.Random().nextDouble()', Blockly.Dart.ORDER_UNARY_POSTFIX];
};

Blockly.Dart['math_atan2'] = function(block) {
  // Arctangent of point (X, Y) in degrees from -180 to 180.
  Blockly.Dart.definitions_['import_dart_math'] =
      'import \'dart:math\' as Math;';
  var argument0 = Blockly.Dart.valueToCode(block, 'X',
      Blockly.Dart.ORDER_NONE) || '0';
  var argument1 = Blockly.Dart.valueToCode(block, 'Y',
      Blockly.Dart.ORDER_NONE) || '0';
  return ['Math.atan2(' + argument1 + ', ' + argument0 + ') / Math.pi * 180',
      Blockly.Dart.ORDER_MULTIPLICATIVE];
};
/**
 * @license
 * Copyright 2014 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Generating Dart for procedure blocks.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

goog.provide('Blockly.Dart.procedures');

goog.require('Blockly.Dart');


Blockly.Dart['procedures_defreturn'] = function(block) {
  // Define a procedure with a return value.
  var funcName = Blockly.Dart.variableDB_.getName(block.getFieldValue('NAME'),
      Blockly.PROCEDURE_CATEGORY_NAME);
  var xfix1 = '';
  if (Blockly.Dart.STATEMENT_PREFIX) {
    xfix1 += Blockly.Dart.injectId(Blockly.Dart.STATEMENT_PREFIX, block);
  }
  if (Blockly.Dart.STATEMENT_SUFFIX) {
    xfix1 += Blockly.Dart.injectId(Blockly.Dart.STATEMENT_SUFFIX, block);
  }
  if (xfix1) {
    xfix1 = Blockly.Dart.prefixLines(xfix1, Blockly.Dart.INDENT);
  }
  var loopTrap = '';
  if (Blockly.Dart.INFINITE_LOOP_TRAP) {
    loopTrap = Blockly.Dart.prefixLines(
        Blockly.Dart.injectId(Blockly.Dart.INFINITE_LOOP_TRAP, block),
        Blockly.Dart.INDENT);
  }
  var branch = Blockly.Dart.statementToCode(block, 'STACK');
  var returnValue = Blockly.Dart.valueToCode(block, 'RETURN',
      Blockly.Dart.ORDER_NONE) || '';
  var xfix2 = '';
  if (branch && returnValue) {
    // After executing the function body, revisit this block for the return.
    xfix2 = xfix1;
  }
  if (returnValue) {
    returnValue = Blockly.Dart.INDENT + 'return ' + returnValue + ';\n';
  }
  var returnType = returnValue ? 'dynamic' : 'void';
  var args = [];
  for (var i = 0; i < block.arguments_.length; i++) {
    args[i] = Blockly.Dart.variableDB_.getName(block.arguments_[i],
        Blockly.VARIABLE_CATEGORY_NAME);
  }
  var code = returnType + ' ' + funcName + '(' + args.join(', ') + ') {\n' +
      xfix1 + loopTrap + branch + xfix2 + returnValue + '}';
  code = Blockly.Dart.scrub_(block, code);
  // Add % so as not to collide with helper functions in definitions list.
  Blockly.Dart.definitions_['%' + funcName] = code;
  return null;
};

// Defining a procedure without a return value uses the same generator as
// a procedure with a return value.
Blockly.Dart['procedures_defnoreturn'] = Blockly.Dart['procedures_defreturn'];

Blockly.Dart['procedures_callreturn'] = function(block) {
  // Call a procedure with a return value.
  var funcName = Blockly.Dart.variableDB_.getName(block.getFieldValue('NAME'),
      Blockly.PROCEDURE_CATEGORY_NAME);
  var args = [];
  for (var i = 0; i < block.arguments_.length; i++) {
    args[i] = Blockly.Dart.valueToCode(block, 'ARG' + i,
        Blockly.Dart.ORDER_NONE) || 'null';
  }
  var code = funcName + '(' + args.join(', ') + ')';
  return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
};

Blockly.Dart['procedures_callnoreturn'] = function(block) {
  // Call a procedure with no return value.
  // Generated code is for a function call as a statement is the same as a
  // function call as a value, with the addition of line ending.
  var tuple = Blockly.Dart['procedures_callreturn'](block);
  return tuple[0] + ';\n';
};

Blockly.Dart['procedures_ifreturn'] = function(block) {
  // Conditionally return value from a procedure.
  var condition = Blockly.Dart.valueToCode(block, 'CONDITION',
      Blockly.Dart.ORDER_NONE) || 'false';
  var code = 'if (' + condition + ') {\n';
  if (Blockly.Dart.STATEMENT_SUFFIX) {
    // Inject any statement suffix here since the regular one at the end
    // will not get executed if the return is triggered.
    code += Blockly.Dart.prefixLines(
        Blockly.Dart.injectId(Blockly.Dart.STATEMENT_SUFFIX, block),
        Blockly.Dart.INDENT);
  }
  if (block.hasReturnValue_) {
    var value = Blockly.Dart.valueToCode(block, 'VALUE',
        Blockly.Dart.ORDER_NONE) || 'null';
    code += Blockly.Dart.INDENT + 'return ' + value + ';\n';
  } else {
    code += Blockly.Dart.INDENT + 'return;\n';
  }
  code += '}\n';
  return code;
};
/**
 * @license
 * Copyright 2014 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Generating Dart for text blocks.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

goog.provide('Blockly.Dart.texts');

goog.require('Blockly.Dart');


Blockly.Dart.addReservedWords('Html,Math');

Blockly.Dart['text'] = function(block) {
  // Text value.
  var code = Blockly.Dart.quote_(block.getFieldValue('TEXT'));
  return [code, Blockly.Dart.ORDER_ATOMIC];
};

Blockly.Dart['text_multiline'] = function(block) {
  // Text value.
  var code = Blockly.Dart.multiline_quote_(block.getFieldValue('TEXT'));
  return [code, Blockly.Dart.ORDER_ATOMIC];
};

Blockly.Dart['text_join'] = function(block) {
  // Create a string made up of any number of elements of any type.
  switch (block.itemCount_) {
    case 0:
      return ['\'\'', Blockly.Dart.ORDER_ATOMIC];
    case 1:
      var element = Blockly.Dart.valueToCode(block, 'ADD0',
              Blockly.Dart.ORDER_UNARY_POSTFIX) || '\'\'';
      var code = element + '.toString()';
      return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
    default:
      var elements = new Array(block.itemCount_);
      for (var i = 0; i < block.itemCount_; i++) {
        elements[i] = Blockly.Dart.valueToCode(block, 'ADD' + i,
                Blockly.Dart.ORDER_NONE) || '\'\'';
      }
      var code = '[' + elements.join(',') + '].join()';
      return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
  }
};

Blockly.Dart['text_append'] = function(block) {
  // Append to a variable in place.
  var varName = Blockly.Dart.variableDB_.getName(block.getFieldValue('VAR'),
      Blockly.VARIABLE_CATEGORY_NAME);
  var value = Blockly.Dart.valueToCode(block, 'TEXT',
      Blockly.Dart.ORDER_NONE) || '\'\'';
  return varName + ' = [' + varName + ', ' + value + '].join();\n';
};

Blockly.Dart['text_length'] = function(block) {
  // String or array length.
  var text = Blockly.Dart.valueToCode(block, 'VALUE',
      Blockly.Dart.ORDER_UNARY_POSTFIX) || '\'\'';
  return [text + '.length', Blockly.Dart.ORDER_UNARY_POSTFIX];
};

Blockly.Dart['text_isEmpty'] = function(block) {
  // Is the string null or array empty?
  var text = Blockly.Dart.valueToCode(block, 'VALUE',
      Blockly.Dart.ORDER_UNARY_POSTFIX) || '\'\'';
  return [text + '.isEmpty', Blockly.Dart.ORDER_UNARY_POSTFIX];
};

Blockly.Dart['text_indexOf'] = function(block) {
  // Search the text for a substring.
  var operator = block.getFieldValue('END') == 'FIRST' ?
      'indexOf' : 'lastIndexOf';
  var substring = Blockly.Dart.valueToCode(block, 'FIND',
      Blockly.Dart.ORDER_NONE) || '\'\'';
  var text = Blockly.Dart.valueToCode(block, 'VALUE',
      Blockly.Dart.ORDER_UNARY_POSTFIX) || '\'\'';
  var code = text + '.' + operator + '(' + substring + ')';
  if (block.workspace.options.oneBasedIndex) {
    return [code + ' + 1', Blockly.Dart.ORDER_ADDITIVE];
  }
  return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
};

Blockly.Dart['text_charAt'] = function(block) {
  // Get letter at index.
  // Note: Until January 2013 this block did not have the WHERE input.
  var where = block.getFieldValue('WHERE') || 'FROM_START';
  var text = Blockly.Dart.valueToCode(block, 'VALUE',
      Blockly.Dart.ORDER_UNARY_POSTFIX) || '\'\'';
  switch (where) {
    case 'FIRST':
      var code = text + '[0]';
      return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
    case 'FROM_START':
      var at = Blockly.Dart.getAdjusted(block, 'AT');
      var code = text + '[' + at + ']';
      return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
    case 'LAST':
      at = 1;
      // Fall through.
    case 'FROM_END':
      var at = Blockly.Dart.getAdjusted(block, 'AT', 1);
      var functionName = Blockly.Dart.provideFunction_(
          'text_get_from_end',
          ['String ' + Blockly.Dart.FUNCTION_NAME_PLACEHOLDER_ +
              '(String text, num x) {',
           '  return text[text.length - x];',
           '}']);
      code = functionName + '(' + text + ', ' + at + ')';
      return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
    case 'RANDOM':
      Blockly.Dart.definitions_['import_dart_math'] =
          'import \'dart:math\' as Math;';
      var functionName = Blockly.Dart.provideFunction_(
          'text_random_letter',
          ['String ' + Blockly.Dart.FUNCTION_NAME_PLACEHOLDER_ +
              '(String text) {',
           '  int x = new Math.Random().nextInt(text.length);',
           '  return text[x];',
           '}']);
      code = functionName + '(' + text + ')';
      return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
  }
  throw Error('Unhandled option (text_charAt).');
};

Blockly.Dart['text_getSubstring'] = function(block) {
  // Get substring.
  var text = Blockly.Dart.valueToCode(block, 'STRING',
      Blockly.Dart.ORDER_UNARY_POSTFIX) || '\'\'';
  var where1 = block.getFieldValue('WHERE1');
  var where2 = block.getFieldValue('WHERE2');
  if (where1 == 'FIRST' && where2 == 'LAST') {
    var code = text;
  } else if (text.match(/^'?\w+'?$/) ||
      (where1 != 'FROM_END' && where2 == 'FROM_START')) {
    // If the text is a variable or literal or doesn't require a call for
    // length, don't generate a helper function.
    switch (where1) {
      case 'FROM_START':
        var at1 = Blockly.Dart.getAdjusted(block, 'AT1');
        break;
      case 'FROM_END':
        var at1 = Blockly.Dart.getAdjusted(block, 'AT1', 1, false,
            Blockly.Dart.ORDER_ADDITIVE);
        at1 = text + '.length - ' + at1;
        break;
      case 'FIRST':
        var at1 = '0';
        break;
      default:
        throw Error('Unhandled option (text_getSubstring).');
    }
    switch (where2) {
      case 'FROM_START':
        var at2 = Blockly.Dart.getAdjusted(block, 'AT2', 1);
        break;
      case 'FROM_END':
        var at2 = Blockly.Dart.getAdjusted(block, 'AT2', 0, false,
            Blockly.Dart.ORDER_ADDITIVE);
        at2 = text + '.length - ' + at2;
        break;
      case 'LAST':
        break;
      default:
        throw Error('Unhandled option (text_getSubstring).');
    }
    if (where2 == 'LAST') {
      var code = text + '.substring(' + at1 + ')';
    } else {
      var code = text + '.substring(' + at1 + ', ' + at2 + ')';
    }
  } else {
    var at1 = Blockly.Dart.getAdjusted(block, 'AT1');
    var at2 = Blockly.Dart.getAdjusted(block, 'AT2');
    var functionName = Blockly.Dart.provideFunction_(
        'text_get_substring',
        ['String ' + Blockly.Dart.FUNCTION_NAME_PLACEHOLDER_ +
            '(String text, String where1, num at1, String where2, num at2) {',
         '  int getAt(String where, num at) {',
         '    if (where == \'FROM_END\') {',
         '      at = text.length - 1 - at;',
         '    } else if (where == \'FIRST\') {',
         '      at = 0;',
         '    } else if (where == \'LAST\') {',
         '      at = text.length - 1;',
         '    } else if (where != \'FROM_START\') {',
         '      throw \'Unhandled option (text_getSubstring).\';',
         '    }',
         '    return at;',
         '  }',
         '  at1 = getAt(where1, at1);',
         '  at2 = getAt(where2, at2) + 1;',
         '  return text.substring(at1, at2);',
         '}']);
    var code = functionName + '(' + text + ', \'' +
        where1 + '\', ' + at1 + ', \'' + where2 + '\', ' + at2 + ')';
  }
  return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
};

Blockly.Dart['text_changeCase'] = function(block) {
  // Change capitalization.
  var OPERATORS = {
    'UPPERCASE': '.toUpperCase()',
    'LOWERCASE': '.toLowerCase()',
    'TITLECASE': null
  };
  var operator = OPERATORS[block.getFieldValue('CASE')];
  var textOrder = operator ? Blockly.Dart.ORDER_UNARY_POSTFIX :
      Blockly.Dart.ORDER_NONE;
  var text = Blockly.Dart.valueToCode(block, 'TEXT', textOrder) || '\'\'';
  if (operator) {
    // Upper and lower case are functions built into Dart.
    var code = text + operator;
  } else {
    // Title case is not a native Dart function.  Define one.
    var functionName = Blockly.Dart.provideFunction_(
        'text_toTitleCase',
        ['String ' + Blockly.Dart.FUNCTION_NAME_PLACEHOLDER_ +
            '(String str) {',
         '  RegExp exp = new RegExp(r\'\\b\');',
         '  List<String> list = str.split(exp);',
         '  final title = new StringBuffer();',
         '  for (String part in list) {',
         '    if (part.length > 0) {',
         '      title.write(part[0].toUpperCase());',
         '      if (part.length > 0) {',
         '        title.write(part.substring(1).toLowerCase());',
         '      }',
         '    }',
         '  }',
         '  return title.toString();',
         '}']);
    var code = functionName + '(' + text + ')';
  }
  return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
};

Blockly.Dart['text_trim'] = function(block) {
  // Trim spaces.
  var OPERATORS = {
    'LEFT': '.replaceFirst(new RegExp(r\'^\\s+\'), \'\')',
    'RIGHT': '.replaceFirst(new RegExp(r\'\\s+$\'), \'\')',
    'BOTH': '.trim()'
  };
  var operator = OPERATORS[block.getFieldValue('MODE')];
  var text = Blockly.Dart.valueToCode(block, 'TEXT',
      Blockly.Dart.ORDER_UNARY_POSTFIX) || '\'\'';
  return [text + operator, Blockly.Dart.ORDER_UNARY_POSTFIX];
};

Blockly.Dart['text_print'] = function(block) {
  // Print statement.
  var msg = Blockly.Dart.valueToCode(block, 'TEXT',
      Blockly.Dart.ORDER_NONE) || '\'\'';
  return 'print(' + msg + ');\n';
};

Blockly.Dart['text_prompt_ext'] = function(block) {
  // Prompt function.
  Blockly.Dart.definitions_['import_dart_html'] =
      'import \'dart:html\' as Html;';
  if (block.getField('TEXT')) {
    // Internal message.
    var msg = Blockly.Dart.quote_(block.getFieldValue('TEXT'));
  } else {
    // External message.
    var msg = Blockly.Dart.valueToCode(block, 'TEXT',
        Blockly.Dart.ORDER_NONE) || '\'\'';
  }
  var code = 'Html.window.prompt(' + msg + ', \'\')';
  var toNumber = block.getFieldValue('TYPE') == 'NUMBER';
  if (toNumber) {
    Blockly.Dart.definitions_['import_dart_math'] =
        'import \'dart:math\' as Math;';
    code = 'Math.parseDouble(' + code + ')';
  }
  return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
};

Blockly.Dart['text_prompt'] = Blockly.Dart['text_prompt_ext'];

Blockly.Dart['text_count'] = function(block) {
  var text = Blockly.Dart.valueToCode(block, 'TEXT',
      Blockly.Dart.ORDER_UNARY_POSTFIX) || '\'\'';
  var sub = Blockly.Dart.valueToCode(block, 'SUB',
      Blockly.Dart.ORDER_NONE) || '\'\'';
  // Substring count is not a native Dart function.  Define one.
  var functionName = Blockly.Dart.provideFunction_(
      'text_count',
      ['int ' + Blockly.Dart.FUNCTION_NAME_PLACEHOLDER_ +
        '(String haystack, String needle) {',
        '  if (needle.length == 0) {',
        '    return haystack.length + 1;',
        '  }',
        '  int index = 0;',
        '  int count = 0;',
        '  while (index != -1) {',
        '    index = haystack.indexOf(needle, index);',
        '    if (index != -1) {',
        '      count++;',
        '     index += needle.length;',
        '    }',
        '  }',
        '  return count;',
        '}']);
  var code = functionName + '(' + text + ', ' + sub + ')';
  return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
};

Blockly.Dart['text_replace'] = function(block) {
  var text = Blockly.Dart.valueToCode(block, 'TEXT',
      Blockly.Dart.ORDER_UNARY_POSTFIX) || '\'\'';
  var from = Blockly.Dart.valueToCode(block, 'FROM',
      Blockly.Dart.ORDER_NONE) || '\'\'';
  var to = Blockly.Dart.valueToCode(block, 'TO',
      Blockly.Dart.ORDER_NONE) || '\'\'';
  var code = text + '.replaceAll(' + from + ', ' + to + ')';
  return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
};

Blockly.Dart['text_reverse'] = function(block) {
  // There isn't a sensible way to do this in Dart. See:
  // http://stackoverflow.com/a/21613700/3529104
  // Implementing something is possibly better than not implementing anything?
  var text = Blockly.Dart.valueToCode(block, 'TEXT',
      Blockly.Dart.ORDER_UNARY_POSTFIX) || '\'\'';
  var code = 'new String.fromCharCodes(' + text + '.runes.toList().reversed)';
  // XXX What should the operator precedence be for a `new`?
  return [code, Blockly.Dart.ORDER_UNARY_POSTFIX];
};
/**
 * @license
 * Copyright 2014 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Generating Dart for variable blocks.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

goog.provide('Blockly.Dart.variables');

goog.require('Blockly.Dart');


Blockly.Dart['variables_get'] = function(block) {
  // Variable getter.
  var code = Blockly.Dart.variableDB_.getName(block.getFieldValue('VAR'),
      Blockly.VARIABLE_CATEGORY_NAME);
  return [code, Blockly.Dart.ORDER_ATOMIC];
};

Blockly.Dart['variables_set'] = function(block) {
  // Variable setter.
  var argument0 = Blockly.Dart.valueToCode(block, 'VALUE',
      Blockly.Dart.ORDER_ASSIGNMENT) || '0';
  var varName = Blockly.Dart.variableDB_.getName(block.getFieldValue('VAR'),
      Blockly.VARIABLE_CATEGORY_NAME);
  return varName + ' = ' + argument0 + ';\n';
};
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Generating Dart for dynamic variable blocks.
 * @author fenichel@google.com (Rachel Fenichel)
 */
'use strict';

goog.provide('Blockly.Dart.variablesDynamic');

goog.require('Blockly.Dart');
goog.require('Blockly.Dart.variables');


// Dart is dynamically typed.
Blockly.Dart['variables_get_dynamic'] = Blockly.Dart['variables_get'];
Blockly.Dart['variables_set_dynamic'] = Blockly.Dart['variables_set'];
