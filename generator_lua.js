/**
 * @license
 * Copyright 2016 Google LLC
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
 * @fileoverview Helper functions for generating Lua for blocks.
 * @author rodrigoq@google.com (Rodrigo Queiro)
 * Based on Ellen Spertus's blocky-lua project.
 */
'use strict';

goog.provide('Blockly.Lua');

goog.require('Blockly.Generator');
goog.require('Blockly.utils.string');


/**
 * Lua code generator.
 * @type {!Blockly.Generator}
 */
Blockly.Lua = new Blockly.Generator('Lua');

/**
 * List of illegal variable names.
 * This is not intended to be a security feature.  Blockly is 100% client-side,
 * so bypassing this list is trivial.  This is intended to prevent users from
 * accidentally clobbering a built-in object or function.
 * @private
 */
Blockly.Lua.addReservedWords(
    // Special character
    '_,' +
    // From theoriginalbit's script:
    // https://github.com/espertus/blockly-lua/issues/6
    '__inext,assert,bit,colors,colours,coroutine,disk,dofile,error,fs,' +
    'fetfenv,getmetatable,gps,help,io,ipairs,keys,loadfile,loadstring,math,' +
    'native,next,os,paintutils,pairs,parallel,pcall,peripheral,print,' +
    'printError,rawequal,rawget,rawset,read,rednet,redstone,rs,select,' +
    'setfenv,setmetatable,sleep,string,table,term,textutils,tonumber,' +
    'tostring,turtle,type,unpack,vector,write,xpcall,_VERSION,__indext,' +
    // Not included in the script, probably because it wasn't enabled:
    'HTTP,' +
    // Keywords (http://www.lua.org/pil/1.3.html).
    'and,break,do,else,elseif,end,false,for,function,if,in,local,nil,not,or,' +
    'repeat,return,then,true,until,while,' +
    // Metamethods (http://www.lua.org/manual/5.2/manual.html).
    'add,sub,mul,div,mod,pow,unm,concat,len,eq,lt,le,index,newindex,call,' +
    // Basic functions (http://www.lua.org/manual/5.2/manual.html, section 6.1).
    'assert,collectgarbage,dofile,error,_G,getmetatable,inpairs,load,' +
    'loadfile,next,pairs,pcall,print,rawequal,rawget,rawlen,rawset,select,' +
    'setmetatable,tonumber,tostring,type,_VERSION,xpcall,' +
    // Modules (http://www.lua.org/manual/5.2/manual.html, section 6.3).
    'require,package,string,table,math,bit32,io,file,os,debug'
);

/**
 * Order of operation ENUMs.
 * http://www.lua.org/manual/5.3/manual.html#3.4.8
 */
Blockly.Lua.ORDER_ATOMIC = 0;          // literals
// The next level was not explicit in documentation and inferred by Ellen.
Blockly.Lua.ORDER_HIGH = 1;            // Function calls, tables[]
Blockly.Lua.ORDER_EXPONENTIATION = 2;  // ^
Blockly.Lua.ORDER_UNARY = 3;           // not # - ~
Blockly.Lua.ORDER_MULTIPLICATIVE = 4;  // * / %
Blockly.Lua.ORDER_ADDITIVE = 5;        // + -
Blockly.Lua.ORDER_CONCATENATION = 6;   // ..
Blockly.Lua.ORDER_RELATIONAL = 7;      // < > <=  >= ~= ==
Blockly.Lua.ORDER_AND = 8;             // and
Blockly.Lua.ORDER_OR = 9;              // or
Blockly.Lua.ORDER_NONE = 99;

/**
 * Note: Lua is not supporting zero-indexing since the language itself is
 * one-indexed, so the generator does not repoct the oneBasedIndex configuration
 * option used for lists and text.
 */

/**
 * Initialise the database of variable names.
 * @param {!Blockly.Workspace} workspace Workspace to generate code from.
 */
Blockly.Lua.init = function(workspace) {
  // Create a dictionary of definitions to be printed before the code.
  Blockly.Lua.definitions_ = Object.create(null);
  // Create a dictionary mapping desired function names in definitions_
  // to actual function names (to avoid collisions with user functions).
  Blockly.Lua.functionNames_ = Object.create(null);

  if (!Blockly.Lua.variableDB_) {
    Blockly.Lua.variableDB_ =
        new Blockly.Names(Blockly.Lua.RESERVED_WORDS_);
  } else {
    Blockly.Lua.variableDB_.reset();
  }
  Blockly.Lua.variableDB_.setVariableMap(workspace.getVariableMap());
};

/**
 * Prepend the generated code with the variable definitions.
 * @param {string} code Generated code.
 * @return {string} Completed code.
 */
Blockly.Lua.finish = function(code) {
  // Convert the definitions dictionary into a list.
  var definitions = [];
  for (var name in Blockly.Lua.definitions_) {
    definitions.push(Blockly.Lua.definitions_[name]);
  }
  // Clean up temporary data.
  delete Blockly.Lua.definitions_;
  delete Blockly.Lua.functionNames_;
  Blockly.Lua.variableDB_.reset();
  return definitions.join('\n\n') + '\n\n\n' + code;
};

/**
 * Naked values are top-level blocks with outputs that aren't plugged into
 * anything. In Lua, an expression is not a legal statement, so we must assign
 * the value to the (conventionally ignored) _.
 * http://lua-users.org/wiki/ExpressionsAsStatements
 * @param {string} line Line of generated code.
 * @return {string} Legal line of code.
 */
Blockly.Lua.scrubNakedValue = function(line) {
  return 'local _ = ' + line + '\n';
};

/**
 * Encode a string as a properly escaped Lua string, complete with
 * quotes.
 * @param {string} string Text to encode.
 * @return {string} Lua string.
 * @private
 */
Blockly.Lua.quote_ = function(string) {
  string = string.replace(/\\/g, '\\\\')
                 .replace(/\n/g, '\\\n')
                 .replace(/'/g, '\\\'');
  return '\'' + string + '\'';
};

/**
 * Encode a string as a properly escaped multiline Lua string, complete with
 * quotes.
 * @param {string} string Text to encode.
 * @return {string} Lua string.
 * @private
 */
Blockly.Lua.multiline_quote_ = function(string) {
  string = string.replace(/\\/g, '\\\\')
                 .replace(/\n/g, '\\\n')
                 .replace(/'/g, '\\\'');
  return '[===' + string + '===]';
};

/**
 * Common tasks for generating Lua from blocks.
 * Handles comments for the specified block and any connected value blocks.
 * Calls any statements following this block.
 * @param {!Blockly.Block} block The current block.
 * @param {string} code The Lua code created for this block.
 * @param {boolean=} opt_thisOnly True to generate code for only this statement.
 * @return {string} Lua code with comments and subsequent blocks added.
 * @private
 */
Blockly.Lua.scrub_ = function(block, code, opt_thisOnly) {
  var commentCode = '';
  // Only collect comments for blocks that aren't inline.
  if (!block.outputConnection || !block.outputConnection.targetConnection) {
    // Collect comment for this block.
    var comment = block.getCommentText();
    if (comment) {
      comment = Blockly.utils.string.wrap(comment,
          Blockly.Lua.COMMENT_WRAP - 3);
      commentCode += Blockly.Lua.prefixLines(comment, '-- ') + '\n';
    }
    // Collect comments for all value arguments.
    // Don't collect comments for nested statements.
    for (var i = 0; i < block.inputList.length; i++) {
      if (block.inputList[i].type == Blockly.INPUT_VALUE) {
        var childBlock = block.inputList[i].connection.targetBlock();
        if (childBlock) {
          comment = Blockly.Lua.allNestedComments(childBlock);
          if (comment) {
            commentCode += Blockly.Lua.prefixLines(comment, '-- ');
          }
        }
      }
    }
  }
  var nextBlock = block.nextConnection && block.nextConnection.targetBlock();
  var nextCode = opt_thisOnly ? '' : Blockly.Lua.blockToCode(nextBlock);
  return commentCode + code + nextCode;
};
/**
 * @license
 * Copyright 2016 Google LLC
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
 * @fileoverview Generating Lua for colour blocks.
 * @author rodrigoq@google.com (Rodrigo Queiro)
 */
'use strict';

goog.provide('Blockly.Lua.colour');

goog.require('Blockly.Lua');


Blockly.Lua['colour_picker'] = function(block) {
  // Colour picker.
  var code = Blockly.Lua.quote_(block.getFieldValue('COLOUR'));
  return [code, Blockly.Lua.ORDER_ATOMIC];
};

Blockly.Lua['colour_random'] = function(block) {
  // Generate a random colour.
  var code = 'string.format("#%06x", math.random(0, 2^24 - 1))';
  return [code, Blockly.Lua.ORDER_HIGH];
};

Blockly.Lua['colour_rgb'] = function(block) {
  // Compose a colour from RGB components expressed as percentages.
  var functionName = Blockly.Lua.provideFunction_(
      'colour_rgb',
      ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ + '(r, g, b)',
       '  r = math.floor(math.min(100, math.max(0, r)) * 2.55 + .5)',
       '  g = math.floor(math.min(100, math.max(0, g)) * 2.55 + .5)',
       '  b = math.floor(math.min(100, math.max(0, b)) * 2.55 + .5)',
       '  return string.format("#%02x%02x%02x", r, g, b)',
       'end']);
  var r = Blockly.Lua.valueToCode(block, 'RED',
      Blockly.Lua.ORDER_NONE) || 0;
  var g = Blockly.Lua.valueToCode(block, 'GREEN',
      Blockly.Lua.ORDER_NONE) || 0;
  var b = Blockly.Lua.valueToCode(block, 'BLUE',
      Blockly.Lua.ORDER_NONE) || 0;
  var code = functionName + '(' + r + ', ' + g + ', ' + b + ')';
  return [code, Blockly.Lua.ORDER_HIGH];
};

Blockly.Lua['colour_blend'] = function(block) {
  // Blend two colours together.
  var functionName = Blockly.Lua.provideFunction_(
      'colour_blend',
      ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ +
           '(colour1, colour2, ratio)',
       '  local r1 = tonumber(string.sub(colour1, 2, 3), 16)',
       '  local r2 = tonumber(string.sub(colour2, 2, 3), 16)',
       '  local g1 = tonumber(string.sub(colour1, 4, 5), 16)',
       '  local g2 = tonumber(string.sub(colour2, 4, 5), 16)',
       '  local b1 = tonumber(string.sub(colour1, 6, 7), 16)',
       '  local b2 = tonumber(string.sub(colour2, 6, 7), 16)',
       '  local ratio = math.min(1, math.max(0, ratio))',
       '  local r = math.floor(r1 * (1 - ratio) + r2 * ratio + .5)',
       '  local g = math.floor(g1 * (1 - ratio) + g2 * ratio + .5)',
       '  local b = math.floor(b1 * (1 - ratio) + b2 * ratio + .5)',
       '  return string.format("#%02x%02x%02x", r, g, b)',
       'end']);
  var colour1 = Blockly.Lua.valueToCode(block, 'COLOUR1',
      Blockly.Lua.ORDER_NONE) || '\'#000000\'';
  var colour2 = Blockly.Lua.valueToCode(block, 'COLOUR2',
      Blockly.Lua.ORDER_NONE) || '\'#000000\'';
  var ratio = Blockly.Lua.valueToCode(block, 'RATIO',
      Blockly.Lua.ORDER_NONE) || 0;
  var code = functionName + '(' + colour1 + ', ' + colour2 + ', ' + ratio + ')';
  return [code, Blockly.Lua.ORDER_HIGH];
};
/**
 * @license
 * Copyright 2016 Google LLC
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
 * @fileoverview Generating Lua for list blocks.
 * @author rodrigoq@google.com (Rodrigo Queiro)
 */
'use strict';

goog.provide('Blockly.Lua.lists');

goog.require('Blockly.Lua');


Blockly.Lua['lists_create_empty'] = function(block) {
  // Create an empty list.
  return ['{}', Blockly.Lua.ORDER_ATOMIC];
};

Blockly.Lua['lists_create_with'] = function(block) {
  // Create a list with any number of elements of any type.
  var elements = new Array(block.itemCount_);
  for (var i = 0; i < block.itemCount_; i++) {
    elements[i] = Blockly.Lua.valueToCode(block, 'ADD' + i,
        Blockly.Lua.ORDER_NONE) || 'None';
  }
  var code = '{' + elements.join(', ') + '}';
  return [code, Blockly.Lua.ORDER_ATOMIC];
};

Blockly.Lua['lists_repeat'] = function(block) {
  // Create a list with one element repeated.
  var functionName = Blockly.Lua.provideFunction_(
      'create_list_repeated',
      ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ + '(item, count)',
       '  local t = {}',
       '  for i = 1, count do',
       '    table.insert(t, item)',
       '  end',
       '  return t',
       'end']);
  var element = Blockly.Lua.valueToCode(block, 'ITEM',
      Blockly.Lua.ORDER_NONE) || 'None';
  var repeatCount = Blockly.Lua.valueToCode(block, 'NUM',
      Blockly.Lua.ORDER_NONE) || '0';
  var code = functionName + '(' + element + ', ' + repeatCount + ')';
  return [code, Blockly.Lua.ORDER_HIGH];
};

Blockly.Lua['lists_length'] = function(block) {
  // String or array length.
  var list = Blockly.Lua.valueToCode(block, 'VALUE',
      Blockly.Lua.ORDER_UNARY) || '{}';
  return ['#' + list, Blockly.Lua.ORDER_UNARY];
};

Blockly.Lua['lists_isEmpty'] = function(block) {
  // Is the string null or array empty?
  var list = Blockly.Lua.valueToCode(block, 'VALUE',
      Blockly.Lua.ORDER_UNARY) || '{}';
  var code = '#' + list + ' == 0';
  return [code, Blockly.Lua.ORDER_RELATIONAL];
};

Blockly.Lua['lists_indexOf'] = function(block) {
  // Find an item in the list.
  var item = Blockly.Lua.valueToCode(block, 'FIND',
      Blockly.Lua.ORDER_NONE) || '\'\'';
  var list = Blockly.Lua.valueToCode(block, 'VALUE',
      Blockly.Lua.ORDER_NONE) || '{}';
  if (block.getFieldValue('END') == 'FIRST') {
    var functionName = Blockly.Lua.provideFunction_(
        'first_index',
        ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ + '(t, elem)',
         '  for k, v in ipairs(t) do',
         '    if v == elem then',
         '      return k',
         '    end',
         '  end',
         '  return 0',
         'end']);
  } else {
    var functionName = Blockly.Lua.provideFunction_(
        'last_index',
        ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ + '(t, elem)',
         '  for i = #t, 1, -1 do',
         '    if t[i] == elem then',
         '      return i',
         '    end',
         '  end',
         '  return 0',
         'end']);
  }
  var code = functionName + '(' + list + ', ' + item + ')';
  return [code, Blockly.Lua.ORDER_HIGH];
};

/**
 * Returns an expression calculating the index into a list.
 * @param {string} listName Name of the list, used to calculate length.
 * @param {string} where The method of indexing, selected by dropdown in Blockly
 * @param {string=} opt_at The optional offset when indexing from start/end.
 * @return {string|undefined} Index expression.
 * @private
 */
Blockly.Lua.lists.getIndex_ = function(listName, where, opt_at) {
  if (where == 'FIRST') {
    return '1';
  } else if (where == 'FROM_END') {
    return '#' + listName + ' + 1 - ' + opt_at;
  } else if (where == 'LAST') {
    return '#' + listName;
  } else if (where == 'RANDOM') {
    return 'math.random(#' + listName + ')';
  } else {
    return opt_at;
  }
};

Blockly.Lua['lists_getIndex'] = function(block) {
  // Get element at index.
  // Note: Until January 2013 this block did not have MODE or WHERE inputs.
  var mode = block.getFieldValue('MODE') || 'GET';
  var where = block.getFieldValue('WHERE') || 'FROM_START';
  var list = Blockly.Lua.valueToCode(block, 'VALUE', Blockly.Lua.ORDER_HIGH) ||
      '{}';
  var getIndex_ = Blockly.Lua.lists.getIndex_;

  // If `list` would be evaluated more than once (which is the case for LAST,
  // FROM_END, and RANDOM) and is non-trivial, make sure to access it only once.
  if ((where == 'LAST' || where == 'FROM_END' || where == 'RANDOM') &&
      !list.match(/^\w+$/)) {
    // `list` is an expression, so we may not evaluate it more than once.
    if (mode == 'REMOVE') {
      // We can use multiple statements.
      var atOrder = (where == 'FROM_END') ? Blockly.Lua.ORDER_ADDITIVE :
          Blockly.Lua.ORDER_NONE;
      var at = Blockly.Lua.valueToCode(block, 'AT', atOrder) || '1';
      var listVar = Blockly.Lua.variableDB_.getDistinctName(
          'tmp_list', Blockly.VARIABLE_CATEGORY_NAME);
      at = getIndex_(listVar, where, at);
      var code = listVar + ' = ' + list + '\n' +
          'table.remove(' + listVar + ', ' + at + ')\n';
      return code;
    } else {
      // We need to create a procedure to avoid reevaluating values.
      var at = Blockly.Lua.valueToCode(block, 'AT', Blockly.Lua.ORDER_NONE) ||
          '1';
      if (mode == 'GET') {
        var functionName = Blockly.Lua.provideFunction_(
            'list_get_' + where.toLowerCase(),
            ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ + '(t' +
                // The value for 'FROM_END' and'FROM_START' depends on `at` so
                // we add it as a parameter.
                ((where == 'FROM_END' || where == 'FROM_START') ?
                    ', at)' : ')'),
             '  return t[' + getIndex_('t', where, 'at') + ']',
             'end']);
      } else {  //  mode == 'GET_REMOVE'
        var functionName = Blockly.Lua.provideFunction_(
            'list_remove_' + where.toLowerCase(),
            ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ + '(t' +
                // The value for 'FROM_END' and'FROM_START' depends on `at` so
                // we add it as a parameter.
                ((where == 'FROM_END' || where == 'FROM_START') ?
                    ', at)' : ')'),
             '  return table.remove(t, ' + getIndex_('t', where, 'at') + ')',
             'end']);
      }
      var code = functionName + '(' + list +
          // The value for 'FROM_END' and 'FROM_START' depends on `at` so we
          // pass it.
          ((where == 'FROM_END' || where == 'FROM_START') ? ', ' + at : '') +
          ')';
      return [code, Blockly.Lua.ORDER_HIGH];
    }
  } else {
    // Either `list` is a simple variable, or we only need to refer to `list`
    // once.
    var atOrder = (mode == 'GET' && where == 'FROM_END') ?
        Blockly.Lua.ORDER_ADDITIVE : Blockly.Lua.ORDER_NONE;
    var at = Blockly.Lua.valueToCode(block, 'AT', atOrder) || '1';
    at = getIndex_(list, where, at);
    if (mode == 'GET') {
      var code = list + '[' + at + ']';
      return [code, Blockly.Lua.ORDER_HIGH];
    } else {
      var code = 'table.remove(' + list + ', ' + at + ')';
      if (mode == 'GET_REMOVE') {
        return [code, Blockly.Lua.ORDER_HIGH];
      } else {  // `mode` == 'REMOVE'
        return code + '\n';
      }
    }
  }
};

Blockly.Lua['lists_setIndex'] = function(block) {
  // Set element at index.
  // Note: Until February 2013 this block did not have MODE or WHERE inputs.
  var list = Blockly.Lua.valueToCode(block, 'LIST',
      Blockly.Lua.ORDER_HIGH) || '{}';
  var mode = block.getFieldValue('MODE') || 'SET';
  var where = block.getFieldValue('WHERE') || 'FROM_START';
  var at = Blockly.Lua.valueToCode(block, 'AT',
      Blockly.Lua.ORDER_ADDITIVE) || '1';
  var value = Blockly.Lua.valueToCode(block, 'TO',
      Blockly.Lua.ORDER_NONE) || 'None';
  var getIndex_ = Blockly.Lua.lists.getIndex_;

  var code = '';
  // If `list` would be evaluated more than once (which is the case for LAST,
  // FROM_END, and RANDOM) and is non-trivial, make sure to access it only once.
  if ((where == 'LAST' || where == 'FROM_END' || where == 'RANDOM') &&
      !list.match(/^\w+$/)) {
    // `list` is an expression, so we may not evaluate it more than once.
    // We can use multiple statements.
    var listVar = Blockly.Lua.variableDB_.getDistinctName(
        'tmp_list', Blockly.VARIABLE_CATEGORY_NAME);
    code = listVar + ' = ' + list + '\n';
    list = listVar;
  }
  if (mode == 'SET') {
    code += list + '[' + getIndex_(list, where, at) + '] = ' + value;
  } else {  // `mode` == 'INSERT'
    // LAST is a special case, because we want to insert
    // *after* not *before*, the existing last element.
    code += 'table.insert(' + list + ', ' +
        (getIndex_(list, where, at) + (where == 'LAST' ? ' + 1' : '')) +
        ', ' + value + ')';
  }
  return code + '\n';
};

Blockly.Lua['lists_getSublist'] = function(block) {
  // Get sublist.
  var list = Blockly.Lua.valueToCode(block, 'LIST',
      Blockly.Lua.ORDER_NONE) || '{}';
  var where1 = block.getFieldValue('WHERE1');
  var where2 = block.getFieldValue('WHERE2');
  var at1 = Blockly.Lua.valueToCode(block, 'AT1',
      Blockly.Lua.ORDER_NONE) || '1';
  var at2 = Blockly.Lua.valueToCode(block, 'AT2',
      Blockly.Lua.ORDER_NONE) || '1';
  var getIndex_ = Blockly.Lua.lists.getIndex_;

  var functionName = Blockly.Lua.provideFunction_(
      'list_sublist_' + where1.toLowerCase() + '_' + where2.toLowerCase(),
      ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ + '(source' +
          // The value for 'FROM_END' and'FROM_START' depends on `at` so
          // we add it as a parameter.
          ((where1 == 'FROM_END' || where1 == 'FROM_START') ? ', at1' : '') +
          ((where2 == 'FROM_END' || where2 == 'FROM_START') ? ', at2' : '') +
          ')',
       '  local t = {}',
       '  local start = ' + getIndex_('source', where1, 'at1'),
       '  local finish = ' + getIndex_('source', where2, 'at2'),
       '  for i = start, finish do',
       '    table.insert(t, source[i])',
       '  end',
       '  return t',
       'end']);
  var code = functionName + '(' + list +
      // The value for 'FROM_END' and 'FROM_START' depends on `at` so we
      // pass it.
      ((where1 == 'FROM_END' || where1 == 'FROM_START') ? ', ' + at1 : '') +
      ((where2 == 'FROM_END' || where2 == 'FROM_START') ? ', ' + at2 : '') +
      ')';
  return [code, Blockly.Lua.ORDER_HIGH];
};

Blockly.Lua['lists_sort'] = function(block) {
  // Block for sorting a list.
  var list = Blockly.Lua.valueToCode(
      block, 'LIST', Blockly.Lua.ORDER_NONE) || '{}';
  var direction = block.getFieldValue('DIRECTION') === '1' ? 1 : -1;
  var type = block.getFieldValue('TYPE');

  var functionName = Blockly.Lua.provideFunction_(
      'list_sort',
      ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ +
          '(list, typev, direction)',
       '  local t = {}',
       '  for n,v in pairs(list) do table.insert(t, v) end', // Shallow-copy.
       '  local compareFuncs = {',
       '    NUMERIC = function(a, b)',
       '      return (tonumber(tostring(a)) or 0)',
       '          < (tonumber(tostring(b)) or 0) end,',
       '    TEXT = function(a, b)',
       '      return tostring(a) < tostring(b) end,',
       '    IGNORE_CASE = function(a, b)',
       '      return string.lower(tostring(a)) < string.lower(tostring(b)) end',
       '  }',
       '  local compareTemp = compareFuncs[typev]',
       '  local compare = compareTemp',
       '  if direction == -1',
       '  then compare = function(a, b) return compareTemp(b, a) end',
       '  end',
       '  table.sort(t, compare)',
       '  return t',
       'end']);

  var code = functionName +
      '(' + list + ',"' + type + '", ' + direction + ')';
  return [code, Blockly.Lua.ORDER_HIGH];
};

Blockly.Lua['lists_split'] = function(block) {
  // Block for splitting text into a list, or joining a list into text.
  var input = Blockly.Lua.valueToCode(block, 'INPUT',
      Blockly.Lua.ORDER_NONE);
  var delimiter = Blockly.Lua.valueToCode(block, 'DELIM',
      Blockly.Lua.ORDER_NONE) || '\'\'';
  var mode = block.getFieldValue('MODE');
  var functionName;
  if (mode == 'SPLIT') {
    if (!input) {
      input = '\'\'';
    }
    functionName = Blockly.Lua.provideFunction_(
        'list_string_split',
        ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ +
            '(input, delim)',
         '  local t = {}',
         '  local pos = 1',
         '  while true do',
         '    next_delim = string.find(input, delim, pos)',
         '    if next_delim == nil then',
         '      table.insert(t, string.sub(input, pos))',
         '      break',
         '    else',
         '      table.insert(t, string.sub(input, pos, next_delim-1))',
         '      pos = next_delim + #delim',
         '    end',
         '  end',
         '  return t',
         'end']);
  } else if (mode == 'JOIN') {
    if (!input) {
      input = '{}';
    }
    functionName = 'table.concat';
  } else {
    throw Error('Unknown mode: ' + mode);
  }
  var code = functionName + '(' + input + ', ' + delimiter + ')';
  return [code, Blockly.Lua.ORDER_HIGH];
};

Blockly.Lua['lists_reverse'] = function(block) {
  // Block for reversing a list.
  var list = Blockly.Lua.valueToCode(block, 'LIST',
      Blockly.Lua.ORDER_NONE) || '{}';
  var functionName = Blockly.Lua.provideFunction_(
      'list_reverse',
      ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ + '(input)',
       '  local reversed = {}',
       '  for i = #input, 1, -1 do',
       '    table.insert(reversed, input[i])',
       '  end',
       '  return reversed',
       'end']);
  var code = functionName + '(' + list + ')';
  return [code, Blockly.Lua.ORDER_HIGH];
};
/**
 * @license
 * Copyright 2016 Google LLC
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
 * @fileoverview Generating Lua for logic blocks.
 * @author rodrigoq@google.com (Rodrigo Queiro)
 */
'use strict';

goog.provide('Blockly.Lua.logic');

goog.require('Blockly.Lua');


Blockly.Lua['controls_if'] = function(block) {
  // If/elseif/else condition.
  var n = 0;
  var code = '', branchCode, conditionCode;
  if (Blockly.Lua.STATEMENT_PREFIX) {
    // Automatic prefix insertion is switched off for this block.  Add manually.
    code += Blockly.Lua.injectId(Blockly.Lua.STATEMENT_PREFIX, block);
  }
  do {
    conditionCode = Blockly.Lua.valueToCode(block, 'IF' + n,
        Blockly.Lua.ORDER_NONE) || 'false';
    branchCode = Blockly.Lua.statementToCode(block, 'DO' + n);
    if (Blockly.Lua.STATEMENT_SUFFIX) {
      branchCode = Blockly.Lua.prefixLines(
          Blockly.Lua.injectId(Blockly.Lua.STATEMENT_SUFFIX, block),
          Blockly.Lua.INDENT) + branchCode;
    }
    code += (n > 0 ? 'else' : '') +
        'if ' + conditionCode + ' then\n' + branchCode;
    ++n;
  } while (block.getInput('IF' + n));

  if (block.getInput('ELSE') || Blockly.Lua.STATEMENT_SUFFIX) {
    branchCode = Blockly.Lua.statementToCode(block, 'ELSE');
    if (Blockly.Lua.STATEMENT_SUFFIX) {
      branchCode = Blockly.Lua.prefixLines(
          Blockly.Lua.injectId(Blockly.Lua.STATEMENT_SUFFIX, block),
          Blockly.Lua.INDENT) + branchCode;
    }
    code += 'else\n' + branchCode;
  }
  return code + 'end\n';
};

Blockly.Lua['controls_ifelse'] = Blockly.Lua['controls_if'];

Blockly.Lua['logic_compare'] = function(block) {
  // Comparison operator.
  var OPERATORS = {
    'EQ': '==',
    'NEQ': '~=',
    'LT': '<',
    'LTE': '<=',
    'GT': '>',
    'GTE': '>='
  };
  var operator = OPERATORS[block.getFieldValue('OP')];
  var argument0 = Blockly.Lua.valueToCode(block, 'A',
      Blockly.Lua.ORDER_RELATIONAL) || '0';
  var argument1 = Blockly.Lua.valueToCode(block, 'B',
      Blockly.Lua.ORDER_RELATIONAL) || '0';
  var code = argument0 + ' ' + operator + ' ' + argument1;
  return [code, Blockly.Lua.ORDER_RELATIONAL];
};

Blockly.Lua['logic_operation'] = function(block) {
  // Operations 'and', 'or'.
  var operator = (block.getFieldValue('OP') == 'AND') ? 'and' : 'or';
  var order = (operator == 'and') ? Blockly.Lua.ORDER_AND :
      Blockly.Lua.ORDER_OR;
  var argument0 = Blockly.Lua.valueToCode(block, 'A', order);
  var argument1 = Blockly.Lua.valueToCode(block, 'B', order);
  if (!argument0 && !argument1) {
    // If there are no arguments, then the return value is false.
    argument0 = 'false';
    argument1 = 'false';
  } else {
    // Single missing arguments have no effect on the return value.
    var defaultArgument = (operator == 'and') ? 'true' : 'false';
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

Blockly.Lua['logic_negate'] = function(block) {
  // Negation.
  var argument0 = Blockly.Lua.valueToCode(block, 'BOOL',
      Blockly.Lua.ORDER_UNARY) || 'true';
  var code = 'not ' + argument0;
  return [code, Blockly.Lua.ORDER_UNARY];
};

Blockly.Lua['logic_boolean'] = function(block) {
  // Boolean values true and false.
  var code = (block.getFieldValue('BOOL') == 'TRUE') ? 'true' : 'false';
  return [code, Blockly.Lua.ORDER_ATOMIC];
};

Blockly.Lua['logic_null'] = function(block) {
  // Null data type.
  return ['nil', Blockly.Lua.ORDER_ATOMIC];
};

Blockly.Lua['logic_ternary'] = function(block) {
  // Ternary operator.
  var value_if = Blockly.Lua.valueToCode(block, 'IF',
      Blockly.Lua.ORDER_AND) || 'false';
  var value_then = Blockly.Lua.valueToCode(block, 'THEN',
      Blockly.Lua.ORDER_AND) || 'nil';
  var value_else = Blockly.Lua.valueToCode(block, 'ELSE',
      Blockly.Lua.ORDER_OR) || 'nil';
  var code = value_if + ' and ' + value_then + ' or ' + value_else;
  return [code, Blockly.Lua.ORDER_OR];
};
/**
 * @license
 * Copyright 2016 Google LLC
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
 * @fileoverview Generating Lua for loop blocks.
 * @author rodrigoq@google.com (Rodrigo Queiro)
 */
'use strict';

goog.provide('Blockly.Lua.loops');

goog.require('Blockly.Lua');


/**
 * This is the text used to implement a <pre>continue</pre>.
 * It is also used to recognise <pre>continue</pre>s in generated code so that
 * the appropriate label can be put at the end of the loop body.
 * @const {string}
 */
Blockly.Lua.CONTINUE_STATEMENT = 'goto continue\n';

/**
 * If the loop body contains a "goto continue" statement, add a continue label
 * to the loop body. Slightly inefficient, as continue labels will be generated
 * in all outer loops, but this is safer than duplicating the logic of
 * blockToCode.
 *
 * @param {string} branch Generated code of the loop body
 * @return {string} Generated label or '' if unnecessary
 * @private
 */
Blockly.Lua.addContinueLabel_ = function(branch) {
  if (branch.indexOf(Blockly.Lua.CONTINUE_STATEMENT) != -1) {
    // False positives are possible (e.g. a string literal), but are harmless.
    return branch + Blockly.Lua.INDENT + '::continue::\n';
  } else {
    return branch;
  }
};

Blockly.Lua['controls_repeat_ext'] = function(block) {
  // Repeat n times.
  if (block.getField('TIMES')) {
    // Internal number.
    var repeats = String(Number(block.getFieldValue('TIMES')));
  } else {
    // External number.
    var repeats = Blockly.Lua.valueToCode(block, 'TIMES',
        Blockly.Lua.ORDER_NONE) || '0';
  }
  if (Blockly.isNumber(repeats)) {
    repeats = parseInt(repeats, 10);
  } else {
    repeats = 'math.floor(' + repeats + ')';
  }
  var branch = Blockly.Lua.statementToCode(block, 'DO');
  branch = Blockly.Lua.addLoopTrap(branch, block);
  branch = Blockly.Lua.addContinueLabel_(branch);
  var loopVar = Blockly.Lua.variableDB_.getDistinctName(
      'count', Blockly.VARIABLE_CATEGORY_NAME);
  var code = 'for ' + loopVar + ' = 1, ' + repeats + ' do\n' +
      branch + 'end\n';
  return code;
};

Blockly.Lua['controls_repeat'] = Blockly.Lua['controls_repeat_ext'];

Blockly.Lua['controls_whileUntil'] = function(block) {
  // Do while/until loop.
  var until = block.getFieldValue('MODE') == 'UNTIL';
  var argument0 = Blockly.Lua.valueToCode(block, 'BOOL',
      until ? Blockly.Lua.ORDER_UNARY :
      Blockly.Lua.ORDER_NONE) || 'false';
  var branch = Blockly.Lua.statementToCode(block, 'DO');
  branch = Blockly.Lua.addLoopTrap(branch, block);
  branch = Blockly.Lua.addContinueLabel_(branch);
  if (until) {
    argument0 = 'not ' + argument0;
  }
  return 'while ' + argument0 + ' do\n' + branch + 'end\n';
};

Blockly.Lua['controls_for'] = function(block) {
  // For loop.
  var variable0 = Blockly.Lua.variableDB_.getName(
      block.getFieldValue('VAR'), Blockly.VARIABLE_CATEGORY_NAME);
  var startVar = Blockly.Lua.valueToCode(block, 'FROM',
      Blockly.Lua.ORDER_NONE) || '0';
  var endVar = Blockly.Lua.valueToCode(block, 'TO',
      Blockly.Lua.ORDER_NONE) || '0';
  var increment = Blockly.Lua.valueToCode(block, 'BY',
      Blockly.Lua.ORDER_NONE) || '1';
  var branch = Blockly.Lua.statementToCode(block, 'DO');
  branch = Blockly.Lua.addLoopTrap(branch, block);
  branch = Blockly.Lua.addContinueLabel_(branch);
  var code = '';
  var incValue;
  if (Blockly.isNumber(startVar) && Blockly.isNumber(endVar) &&
      Blockly.isNumber(increment)) {
    // All arguments are simple numbers.
    var up = Number(startVar) <= Number(endVar);
    var step = Math.abs(Number(increment));
    incValue = (up ? '' : '-') + step;
  } else {
    code = '';
    // Determine loop direction at start, in case one of the bounds
    // changes during loop execution.
    incValue = Blockly.Lua.variableDB_.getDistinctName(
        variable0 + '_inc', Blockly.VARIABLE_CATEGORY_NAME);
    code += incValue + ' = ';
    if (Blockly.isNumber(increment)) {
      code += Math.abs(increment) + '\n';
    } else {
      code += 'math.abs(' + increment + ')\n';
    }
    code += 'if (' + startVar + ') > (' + endVar + ') then\n';
    code += Blockly.Lua.INDENT + incValue + ' = -' + incValue + '\n';
    code += 'end\n';
  }
  code += 'for ' + variable0 + ' = ' + startVar + ', ' + endVar +
      ', ' + incValue;
  code += ' do\n' + branch + 'end\n';
  return code;
};

Blockly.Lua['controls_forEach'] = function(block) {
  // For each loop.
  var variable0 = Blockly.Lua.variableDB_.getName(
      block.getFieldValue('VAR'), Blockly.VARIABLE_CATEGORY_NAME);
  var argument0 = Blockly.Lua.valueToCode(block, 'LIST',
      Blockly.Lua.ORDER_NONE) || '{}';
  var branch = Blockly.Lua.statementToCode(block, 'DO');
  branch = Blockly.Lua.addLoopTrap(branch, block);
  branch = Blockly.Lua.addContinueLabel_(branch);
  var code = 'for _, ' + variable0 + ' in ipairs(' + argument0 + ') do \n' +
      branch + 'end\n';
  return code;
};

Blockly.Lua['controls_flow_statements'] = function(block) {
  // Flow statements: continue, break.
  var xfix = '';
  if (Blockly.Lua.STATEMENT_PREFIX) {
    // Automatic prefix insertion is switched off for this block.  Add manually.
    xfix += Blockly.Lua.injectId(Blockly.Lua.STATEMENT_PREFIX, block);
  }
  if (Blockly.Lua.STATEMENT_SUFFIX) {
    // Inject any statement suffix here since the regular one at the end
    // will not get executed if the break/continue is triggered.
    xfix += Blockly.Lua.injectId(Blockly.Lua.STATEMENT_SUFFIX, block);
  }
  if (Blockly.Lua.STATEMENT_PREFIX) {
    var loop = Blockly.Constants.Loops
        .CONTROL_FLOW_IN_LOOP_CHECK_MIXIN.getSurroundLoop(block);
    if (loop && !loop.suppressPrefixSuffix) {
      // Inject loop's statement prefix here since the regular one at the end
      // of the loop will not get executed if 'continue' is triggered.
      // In the case of 'break', a prefix is needed due to the loop's suffix.
      xfix += Blockly.Lua.injectId(Blockly.Lua.STATEMENT_PREFIX, loop);
    }
  }
  switch (block.getFieldValue('FLOW')) {
    case 'BREAK':
      return xfix + 'break\n';
    case 'CONTINUE':
      return xfix + Blockly.Lua.CONTINUE_STATEMENT;
  }
  throw Error('Unknown flow statement.');
};
/**
 * @license
 * Copyright 2016 Google LLC
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
 * @fileoverview Generating Lua for math blocks.
 * @author rodrigoq@google.com (Rodrigo Queiro)
 */
'use strict';

goog.provide('Blockly.Lua.math');

goog.require('Blockly.Lua');


Blockly.Lua['math_number'] = function(block) {
  // Numeric value.
  var code = Number(block.getFieldValue('NUM'));
  var order = code < 0 ? Blockly.Lua.ORDER_UNARY :
              Blockly.Lua.ORDER_ATOMIC;
  return [code, order];
};

Blockly.Lua['math_arithmetic'] = function(block) {
  // Basic arithmetic operators, and power.
  var OPERATORS = {
    ADD: [' + ', Blockly.Lua.ORDER_ADDITIVE],
    MINUS: [' - ', Blockly.Lua.ORDER_ADDITIVE],
    MULTIPLY: [' * ', Blockly.Lua.ORDER_MULTIPLICATIVE],
    DIVIDE: [' / ', Blockly.Lua.ORDER_MULTIPLICATIVE],
    POWER: [' ^ ', Blockly.Lua.ORDER_EXPONENTIATION]
  };
  var tuple = OPERATORS[block.getFieldValue('OP')];
  var operator = tuple[0];
  var order = tuple[1];
  var argument0 = Blockly.Lua.valueToCode(block, 'A', order) || '0';
  var argument1 = Blockly.Lua.valueToCode(block, 'B', order) || '0';
  var code = argument0 + operator + argument1;
  return [code, order];
};

Blockly.Lua['math_single'] = function(block) {
  // Math operators with single operand.
  var operator = block.getFieldValue('OP');
  var code;
  var arg;
  if (operator == 'NEG') {
    // Negation is a special case given its different operator precedence.
    arg = Blockly.Lua.valueToCode(block, 'NUM',
        Blockly.Lua.ORDER_UNARY) || '0';
    return ['-' + arg, Blockly.Lua.ORDER_UNARY];
  }
  if (operator == 'POW10') {
    arg = Blockly.Lua.valueToCode(block, 'NUM',
        Blockly.Lua.ORDER_EXPONENTIATION) || '0';
    return ['10 ^ ' + arg, Blockly.Lua.ORDER_EXPONENTIATION];
  }
  if (operator == 'ROUND') {
    arg = Blockly.Lua.valueToCode(block, 'NUM',
        Blockly.Lua.ORDER_ADDITIVE) || '0';
  } else {
    arg = Blockly.Lua.valueToCode(block, 'NUM',
        Blockly.Lua.ORDER_NONE) || '0';
  }
  switch (operator) {
    case 'ABS':
      code = 'math.abs(' + arg + ')';
      break;
    case 'ROOT':
      code = 'math.sqrt(' + arg + ')';
      break;
    case 'LN':
      code = 'math.log(' + arg + ')';
      break;
    case 'LOG10':
      code = 'math.log(' + arg + ', 10)';
      break;
    case 'EXP':
      code = 'math.exp(' + arg + ')';
      break;
    case 'ROUND':
      // This rounds up.  Blockly does not specify rounding direction.
      code = 'math.floor(' + arg + ' + .5)';
      break;
    case 'ROUNDUP':
      code = 'math.ceil(' + arg + ')';
      break;
    case 'ROUNDDOWN':
      code = 'math.floor(' + arg + ')';
      break;
    case 'SIN':
      code = 'math.sin(math.rad(' + arg + '))';
      break;
    case 'COS':
      code = 'math.cos(math.rad(' + arg + '))';
      break;
    case 'TAN':
      code = 'math.tan(math.rad(' + arg + '))';
      break;
    case 'ASIN':
      code = 'math.deg(math.asin(' + arg + '))';
      break;
    case 'ACOS':
      code = 'math.deg(math.acos(' + arg + '))';
      break;
    case 'ATAN':
      code = 'math.deg(math.atan(' + arg + '))';
      break;
    default:
      throw Error('Unknown math operator: ' + operator);
  }
  return [code, Blockly.Lua.ORDER_HIGH];
};

Blockly.Lua['math_constant'] = function(block) {
  // Constants: PI, E, the Golden Ratio, sqrt(2), 1/sqrt(2), INFINITY.
  var CONSTANTS = {
    PI: ['math.pi', Blockly.Lua.ORDER_HIGH],
    E: ['math.exp(1)', Blockly.Lua.ORDER_HIGH],
    GOLDEN_RATIO: ['(1 + math.sqrt(5)) / 2', Blockly.Lua.ORDER_MULTIPLICATIVE],
    SQRT2: ['math.sqrt(2)', Blockly.Lua.ORDER_HIGH],
    SQRT1_2: ['math.sqrt(1 / 2)', Blockly.Lua.ORDER_HIGH],
    INFINITY: ['math.huge', Blockly.Lua.ORDER_HIGH]
  };
  return CONSTANTS[block.getFieldValue('CONSTANT')];
};

Blockly.Lua['math_number_property'] = function(block) {
  // Check if a number is even, odd, prime, whole, positive, or negative
  // or if it is divisible by certain number. Returns true or false.
  var number_to_check = Blockly.Lua.valueToCode(block, 'NUMBER_TO_CHECK',
      Blockly.Lua.ORDER_MULTIPLICATIVE) || '0';
  var dropdown_property = block.getFieldValue('PROPERTY');
  var code;
  if (dropdown_property == 'PRIME') {
    // Prime is a special case as it is not a one-liner test.
    var functionName = Blockly.Lua.provideFunction_(
        'math_isPrime',
        ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ + '(n)',
         '  -- https://en.wikipedia.org/wiki/Primality_test#Naive_methods',
         '  if n == 2 or n == 3 then',
         '    return true',
         '  end',
         '  -- False if n is NaN, negative, is 1, or not whole.',
         '  -- And false if n is divisible by 2 or 3.',
         '  if not(n > 1) or n % 1 ~= 0 or n % 2 == 0 or n % 3 == 0 then',
         '    return false',
         '  end',
         '  -- Check all the numbers of form 6k +/- 1, up to sqrt(n).',
         '  for x = 6, math.sqrt(n) + 1.5, 6 do',
         '    if n % (x - 1) == 0 or n % (x + 1) == 0 then',
         '      return false',
         '    end',
         '  end',
         '  return true',
         'end']);
    code = functionName + '(' + number_to_check + ')';
    return [code, Blockly.Lua.ORDER_HIGH];
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
      var divisor = Blockly.Lua.valueToCode(block, 'DIVISOR',
          Blockly.Lua.ORDER_MULTIPLICATIVE);
      // If 'divisor' is some code that evals to 0, Lua will produce a nan.
      // Let's produce nil if we can determine this at compile-time.
      if (!divisor || divisor == '0') {
        return ['nil', Blockly.Lua.ORDER_ATOMIC];
      }
      // The normal trick to implement ?: with and/or doesn't work here:
      //   divisor == 0 and nil or number_to_check % divisor == 0
      // because nil is false, so allow a runtime failure. :-(
      code = number_to_check + ' % ' + divisor + ' == 0';
      break;
  }
  return [code, Blockly.Lua.ORDER_RELATIONAL];
};

Blockly.Lua['math_change'] = function(block) {
  // Add to a variable in place.
  var argument0 = Blockly.Lua.valueToCode(block, 'DELTA',
      Blockly.Lua.ORDER_ADDITIVE) || '0';
  var varName = Blockly.Lua.variableDB_.getName(
      block.getFieldValue('VAR'), Blockly.VARIABLE_CATEGORY_NAME);
  return varName + ' = ' + varName + ' + ' + argument0 + '\n';
};

// Rounding functions have a single operand.
Blockly.Lua['math_round'] = Blockly.Lua['math_single'];
// Trigonometry functions have a single operand.
Blockly.Lua['math_trig'] = Blockly.Lua['math_single'];

Blockly.Lua['math_on_list'] = function(block) {
  // Math functions for lists.
  var func = block.getFieldValue('OP');
  var list = Blockly.Lua.valueToCode(block, 'LIST',
      Blockly.Lua.ORDER_NONE) || '{}';
  var functionName;

  // Functions needed in more than one case.
  function provideSum() {
    return Blockly.Lua.provideFunction_(
        'math_sum',
        ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ + '(t)',
         '  local result = 0',
         '  for _, v in ipairs(t) do',
         '    result = result + v',
         '  end',
         '  return result',
         'end']);
  }

  switch (func) {
    case 'SUM':
      functionName = provideSum();
      break;

    case 'MIN':
      // Returns 0 for the empty list.
      functionName = Blockly.Lua.provideFunction_(
          'math_min',
          ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ + '(t)',
           '  if #t == 0 then',
           '    return 0',
           '  end',
           '  local result = math.huge',
           '  for _, v in ipairs(t) do',
           '    if v < result then',
           '      result = v',
           '    end',
           '  end',
           '  return result',
           'end']);
      break;

    case 'AVERAGE':
      // Returns 0 for the empty list.
      functionName = Blockly.Lua.provideFunction_(
          'math_average',
          ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ + '(t)',
           '  if #t == 0 then',
           '    return 0',
           '  end',
           '  return ' + provideSum() + '(t) / #t',
           'end']);
      break;

    case 'MAX':
      // Returns 0 for the empty list.
      functionName = Blockly.Lua.provideFunction_(
          'math_max',
          ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ + '(t)',
           '  if #t == 0 then',
           '    return 0',
           '  end',
           '  local result = -math.huge',
           '  for _, v in ipairs(t) do',
           '    if v > result then',
           '      result = v',
           '    end',
           '  end',
           '  return result',
           'end']);
      break;

    case 'MEDIAN':
      functionName = Blockly.Lua.provideFunction_(
          'math_median',
          // This operation excludes non-numbers.
          ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ + '(t)',
           '  -- Source: http://lua-users.org/wiki/SimpleStats',
           '  if #t == 0 then',
           '    return 0',
           '  end',
           '  local temp={}',
           '  for _, v in ipairs(t) do',
           '    if type(v) == "number" then',
           '      table.insert(temp, v)',
           '    end',
           '  end',
           '  table.sort(temp)',
           '  if #temp % 2 == 0 then',
           '    return (temp[#temp/2] + temp[(#temp/2)+1]) / 2',
           '  else',
           '    return temp[math.ceil(#temp/2)]',
           '  end',
           'end']);
      break;

    case 'MODE':
      functionName = Blockly.Lua.provideFunction_(
          'math_modes',
          // As a list of numbers can contain more than one mode,
          // the returned result is provided as an array.
          // The Lua version includes non-numbers.
          ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ + '(t)',
           '  -- Source: http://lua-users.org/wiki/SimpleStats',
           '  local counts={}',
           '  for _, v in ipairs(t) do',
           '    if counts[v] == nil then',
           '      counts[v] = 1',
           '    else',
           '      counts[v] = counts[v] + 1',
           '    end',
           '  end',
           '  local biggestCount = 0',
           '  for _, v  in pairs(counts) do',
           '    if v > biggestCount then',
           '      biggestCount = v',
           '    end',
           '  end',
           '  local temp={}',
           '  for k, v in pairs(counts) do',
           '    if v == biggestCount then',
           '      table.insert(temp, k)',
           '    end',
           '  end',
           '  return temp',
           'end']);
      break;

    case 'STD_DEV':
      functionName = Blockly.Lua.provideFunction_(
          'math_standard_deviation',
          ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ + '(t)',
           '  local m',
           '  local vm',
           '  local total = 0',
           '  local count = 0',
           '  local result',
           '  m = #t == 0 and 0 or ' + provideSum() + '(t) / #t',
           '  for _, v in ipairs(t) do',
           "    if type(v) == 'number' then",
           '      vm = v - m',
           '      total = total + (vm * vm)',
           '      count = count + 1',
           '    end',
           '  end',
           '  result = math.sqrt(total / (count-1))',
           '  return result',
           'end']);
      break;

    case 'RANDOM':
      functionName = Blockly.Lua.provideFunction_(
          'math_random_list',
          ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ + '(t)',
           '  if #t == 0 then',
           '    return nil',
           '  end',
           '  return t[math.random(#t)]',
           'end']);
      break;

    default:
      throw Error('Unknown operator: ' + func);
  }
  return [functionName + '(' + list + ')', Blockly.Lua.ORDER_HIGH];
};

Blockly.Lua['math_modulo'] = function(block) {
  // Remainder computation.
  var argument0 = Blockly.Lua.valueToCode(block, 'DIVIDEND',
      Blockly.Lua.ORDER_MULTIPLICATIVE) || '0';
  var argument1 = Blockly.Lua.valueToCode(block, 'DIVISOR',
      Blockly.Lua.ORDER_MULTIPLICATIVE) || '0';
  var code = argument0 + ' % ' + argument1;
  return [code, Blockly.Lua.ORDER_MULTIPLICATIVE];
};

Blockly.Lua['math_constrain'] = function(block) {
  // Constrain a number between two limits.
  var argument0 = Blockly.Lua.valueToCode(block, 'VALUE',
      Blockly.Lua.ORDER_NONE) || '0';
  var argument1 = Blockly.Lua.valueToCode(block, 'LOW',
      Blockly.Lua.ORDER_NONE) || '-math.huge';
  var argument2 = Blockly.Lua.valueToCode(block, 'HIGH',
      Blockly.Lua.ORDER_NONE) || 'math.huge';
  var code = 'math.min(math.max(' + argument0 + ', ' + argument1 + '), ' +
      argument2 + ')';
  return [code, Blockly.Lua.ORDER_HIGH];
};

Blockly.Lua['math_random_int'] = function(block) {
  // Random integer between [X] and [Y].
  var argument0 = Blockly.Lua.valueToCode(block, 'FROM',
      Blockly.Lua.ORDER_NONE) || '0';
  var argument1 = Blockly.Lua.valueToCode(block, 'TO',
      Blockly.Lua.ORDER_NONE) || '0';
  var code = 'math.random(' + argument0 + ', ' + argument1 + ')';
  return [code, Blockly.Lua.ORDER_HIGH];
};

Blockly.Lua['math_random_float'] = function(block) {
  // Random fraction between 0 and 1.
  return ['math.random()', Blockly.Lua.ORDER_HIGH];
};

Blockly.Lua['math_atan2'] = function(block) {
  // Arctangent of point (X, Y) in degrees from -180 to 180.
  var argument0 = Blockly.Lua.valueToCode(block, 'X',
      Blockly.Lua.ORDER_NONE) || '0';
  var argument1 = Blockly.Lua.valueToCode(block, 'Y',
      Blockly.Lua.ORDER_NONE) || '0';
  return ['math.deg(math.atan2(' + argument1 + ', ' + argument0 + '))',
      Blockly.Lua.ORDER_HIGH];
};
/**
 * @license
 * Copyright 2016 Google LLC
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
 * @fileoverview Generating Lua for procedure blocks.
 * @author rodrigoq@google.com (Rodrigo Queiro)
 */
'use strict';

goog.provide('Blockly.Lua.procedures');

goog.require('Blockly.Lua');


Blockly.Lua['procedures_defreturn'] = function(block) {
  // Define a procedure with a return value.
  var funcName = Blockly.Lua.variableDB_.getName(
      block.getFieldValue('NAME'), Blockly.PROCEDURE_CATEGORY_NAME);
  var xfix1 = '';
  if (Blockly.Lua.STATEMENT_PREFIX) {
    xfix1 += Blockly.Lua.injectId(Blockly.Lua.STATEMENT_PREFIX, block);
  }
  if (Blockly.Lua.STATEMENT_SUFFIX) {
    xfix1 += Blockly.Lua.injectId(Blockly.Lua.STATEMENT_SUFFIX, block);
  }
  if (xfix1) {
    xfix1 = Blockly.Lua.prefixLines(xfix1, Blockly.Lua.INDENT);
  }
  var loopTrap = '';
  if (Blockly.Lua.INFINITE_LOOP_TRAP) {
    loopTrap = Blockly.Lua.prefixLines(
        Blockly.Lua.injectId(Blockly.Lua.INFINITE_LOOP_TRAP, block),
        Blockly.Lua.INDENT);
  }
  var branch = Blockly.Lua.statementToCode(block, 'STACK');
  var returnValue = Blockly.Lua.valueToCode(block, 'RETURN',
      Blockly.Lua.ORDER_NONE) || '';
  var xfix2 = '';
  if (branch && returnValue) {
    // After executing the function body, revisit this block for the return.
    xfix2 = xfix1;
  }
  if (returnValue) {
    returnValue = Blockly.Lua.INDENT + 'return ' + returnValue + '\n';
  } else if (!branch) {
    branch = '';
  }
  var args = [];
  for (var i = 0; i < block.arguments_.length; i++) {
    args[i] = Blockly.Lua.variableDB_.getName(block.arguments_[i],
        Blockly.VARIABLE_CATEGORY_NAME);
  }
  var code = 'function ' + funcName + '(' + args.join(', ') + ')\n' +
      xfix1 + loopTrap + branch + xfix2 + returnValue + 'end\n';
  code = Blockly.Lua.scrub_(block, code);
  // Add % so as not to collide with helper functions in definitions list.
  Blockly.Lua.definitions_['%' + funcName] = code;
  return null;
};

// Defining a procedure without a return value uses the same generator as
// a procedure with a return value.
Blockly.Lua['procedures_defnoreturn'] =
    Blockly.Lua['procedures_defreturn'];

Blockly.Lua['procedures_callreturn'] = function(block) {
  // Call a procedure with a return value.
  var funcName = Blockly.Lua.variableDB_.getName(
      block.getFieldValue('NAME'), Blockly.PROCEDURE_CATEGORY_NAME);
  var args = [];
  for (var i = 0; i < block.arguments_.length; i++) {
    args[i] = Blockly.Lua.valueToCode(block, 'ARG' + i,
        Blockly.Lua.ORDER_NONE) || 'nil';
  }
  var code = funcName + '(' + args.join(', ') + ')';
  return [code, Blockly.Lua.ORDER_HIGH];
};

Blockly.Lua['procedures_callnoreturn'] = function(block) {
  // Call a procedure with no return value.
  // Generated code is for a function call as a statement is the same as a
  // function call as a value, with the addition of line ending.
  var tuple = Blockly.Lua['procedures_callreturn'](block);
  return tuple[0] + '\n';
};

Blockly.Lua['procedures_ifreturn'] = function(block) {
  // Conditionally return value from a procedure.
  var condition = Blockly.Lua.valueToCode(block, 'CONDITION',
      Blockly.Lua.ORDER_NONE) || 'false';
  var code = 'if ' + condition + ' then\n';
  if (Blockly.Lua.STATEMENT_SUFFIX) {
    // Inject any statement suffix here since the regular one at the end
    // will not get executed if the return is triggered.
    code += Blockly.Lua.prefixLines(
        Blockly.Lua.injectId(Blockly.Lua.STATEMENT_SUFFIX, block),
        Blockly.Lua.INDENT);
  }
  if (block.hasReturnValue_) {
    var value = Blockly.Lua.valueToCode(block, 'VALUE',
        Blockly.Lua.ORDER_NONE) || 'nil';
    code += Blockly.Lua.INDENT + 'return ' + value + '\n';
  } else {
    code += Blockly.Lua.INDENT + 'return\n';
  }
  code += 'end\n';
  return code;
};
/**
 * @license
 * Copyright 2016 Google LLC
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
 * @fileoverview Generating Lua for text blocks.
 * @author rodrigoq@google.com (Rodrigo Queiro)
 */
'use strict';

goog.provide('Blockly.Lua.texts');

goog.require('Blockly.Lua');


Blockly.Lua['text'] = function(block) {
  // Text value.
  var code = Blockly.Lua.quote_(block.getFieldValue('TEXT'));
  return [code, Blockly.Lua.ORDER_ATOMIC];
};

Blockly.Lua['text_multiline'] = function(block) {
  // Text value.
  var code = Blockly.Lua.multiline_quote_(block.getFieldValue('TEXT'));
  return [code, Blockly.Lua.ORDER_ATOMIC];
};

Blockly.Lua['text_join'] = function(block) {
  // Create a string made up of any number of elements of any type.
  if (block.itemCount_ == 0) {
    return ['\'\'', Blockly.Lua.ORDER_ATOMIC];
  } else if (block.itemCount_ == 1) {
    var element = Blockly.Lua.valueToCode(block, 'ADD0',
        Blockly.Lua.ORDER_NONE) || '\'\'';
    var code = 'tostring(' + element + ')';
    return [code, Blockly.Lua.ORDER_HIGH];
  } else if (block.itemCount_ == 2) {
    var element0 = Blockly.Lua.valueToCode(block, 'ADD0',
        Blockly.Lua.ORDER_CONCATENATION) || '\'\'';
    var element1 = Blockly.Lua.valueToCode(block, 'ADD1',
        Blockly.Lua.ORDER_CONCATENATION) || '\'\'';
    var code = element0 + ' .. ' + element1;
    return [code, Blockly.Lua.ORDER_CONCATENATION];
  } else {
    var elements = [];
    for (var i = 0; i < block.itemCount_; i++) {
      elements[i] = Blockly.Lua.valueToCode(block, 'ADD' + i,
          Blockly.Lua.ORDER_NONE) || '\'\'';
    }
    var code = 'table.concat({' + elements.join(', ') + '})';
    return [code, Blockly.Lua.ORDER_HIGH];
  }
};

Blockly.Lua['text_append'] = function(block) {
  // Append to a variable in place.
  var varName = Blockly.Lua.variableDB_.getName(
      block.getFieldValue('VAR'), Blockly.VARIABLE_CATEGORY_NAME);
  var value = Blockly.Lua.valueToCode(block, 'TEXT',
      Blockly.Lua.ORDER_CONCATENATION) || '\'\'';
  return varName + ' = ' + varName + ' .. ' + value + '\n';
};

Blockly.Lua['text_length'] = function(block) {
  // String or array length.
  var text = Blockly.Lua.valueToCode(block, 'VALUE',
      Blockly.Lua.ORDER_UNARY) || '\'\'';
  return ['#' + text, Blockly.Lua.ORDER_UNARY];
};

Blockly.Lua['text_isEmpty'] = function(block) {
  // Is the string null or array empty?
  var text = Blockly.Lua.valueToCode(block, 'VALUE',
      Blockly.Lua.ORDER_UNARY) || '\'\'';
  return ['#' + text + ' == 0', Blockly.Lua.ORDER_RELATIONAL];
};

Blockly.Lua['text_indexOf'] = function(block) {
  // Search the text for a substring.
  var substring = Blockly.Lua.valueToCode(block, 'FIND',
      Blockly.Lua.ORDER_NONE) || '\'\'';
  var text = Blockly.Lua.valueToCode(block, 'VALUE',
      Blockly.Lua.ORDER_NONE) || '\'\'';
  if (block.getFieldValue('END') == 'FIRST') {
    var functionName = Blockly.Lua.provideFunction_(
        'firstIndexOf',
        ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ +
             '(str, substr) ',
         '  local i = string.find(str, substr, 1, true)',
         '  if i == nil then',
         '    return 0',
         '  else',
         '    return i',
         '  end',
         'end']);
  } else {
    var functionName = Blockly.Lua.provideFunction_(
        'lastIndexOf',
        ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ +
             '(str, substr)',
         '  local i = string.find(string.reverse(str), ' +
             'string.reverse(substr), 1, true)',
         '  if i then',
         '    return #str + 2 - i - #substr',
         '  end',
         '  return 0',
         'end']);
  }
  var code = functionName + '(' + text + ', ' + substring + ')';
  return [code, Blockly.Lua.ORDER_HIGH];
};

Blockly.Lua['text_charAt'] = function(block) {
  // Get letter at index.
  // Note: Until January 2013 this block did not have the WHERE input.
  var where = block.getFieldValue('WHERE') || 'FROM_START';
  var atOrder = (where == 'FROM_END') ? Blockly.Lua.ORDER_UNARY :
      Blockly.Lua.ORDER_NONE;
  var at = Blockly.Lua.valueToCode(block, 'AT', atOrder) || '1';
  var text = Blockly.Lua.valueToCode(block, 'VALUE',
      Blockly.Lua.ORDER_NONE) || '\'\'';
  var code;
  if (where == 'RANDOM') {
    var functionName = Blockly.Lua.provideFunction_(
        'text_random_letter',
        ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ + '(str)',
         '  local index = math.random(string.len(str))',
         '  return string.sub(str, index, index)',
         'end']);
    code = functionName + '(' + text + ')';
  } else {
    if (where == 'FIRST') {
      var start = '1';
    } else if (where == 'LAST') {
      var start = '-1';
    } else {
      if (where == 'FROM_START') {
        var start = at;
      } else if (where == 'FROM_END') {
        var start = '-' + at;
      } else {
        throw Error('Unhandled option (text_charAt).');
      }
    }
    if (start.match(/^-?\w*$/)) {
      code = 'string.sub(' + text + ', ' + start + ', ' + start + ')';
    } else {
      // use function to avoid reevaluation
      var functionName = Blockly.Lua.provideFunction_(
          'text_char_at',
          ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ +
               '(str, index)',
           '  return string.sub(str, index, index)',
           'end']);
      code = functionName + '(' + text + ', ' + start + ')';
    }
  }
  return [code, Blockly.Lua.ORDER_HIGH];
};

Blockly.Lua['text_getSubstring'] = function(block) {
  // Get substring.
  var text = Blockly.Lua.valueToCode(block, 'STRING',
      Blockly.Lua.ORDER_NONE) || '\'\'';

  // Get start index.
  var where1 = block.getFieldValue('WHERE1');
  var at1Order = (where1 == 'FROM_END') ? Blockly.Lua.ORDER_UNARY :
      Blockly.Lua.ORDER_NONE;
  var at1 = Blockly.Lua.valueToCode(block, 'AT1', at1Order) || '1';
  if (where1 == 'FIRST') {
    var start = 1;
  } else if (where1 == 'FROM_START') {
    var start = at1;
  } else if (where1 == 'FROM_END') {
    var start = '-' + at1;
  } else {
    throw Error('Unhandled option (text_getSubstring)');
  }

  // Get end index.
  var where2 = block.getFieldValue('WHERE2');
  var at2Order = (where2 == 'FROM_END') ? Blockly.Lua.ORDER_UNARY :
      Blockly.Lua.ORDER_NONE;
  var at2 = Blockly.Lua.valueToCode(block, 'AT2', at2Order) || '1';
  if (where2 == 'LAST') {
    var end = -1;
  } else if (where2 == 'FROM_START') {
    var end = at2;
  } else if (where2 == 'FROM_END') {
    var end = '-' + at2;
  } else {
    throw Error('Unhandled option (text_getSubstring)');
  }
  var code = 'string.sub(' + text + ', ' + start + ', ' + end + ')';
  return [code, Blockly.Lua.ORDER_HIGH];
};

Blockly.Lua['text_changeCase'] = function(block) {
  // Change capitalization.
  var operator = block.getFieldValue('CASE');
  var text = Blockly.Lua.valueToCode(block, 'TEXT',
      Blockly.Lua.ORDER_NONE) || '\'\'';
  if (operator == 'UPPERCASE') {
    var functionName = 'string.upper';
  } else if (operator == 'LOWERCASE') {
    var functionName = 'string.lower';
  } else if (operator == 'TITLECASE') {
    var functionName = Blockly.Lua.provideFunction_(
        'text_titlecase',
        // There are shorter versions at
        // http://lua-users.org/wiki/SciteTitleCase
        // that do not preserve whitespace.
        ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ + '(str)',
         '  local buf = {}',
         '  local inWord = false',
         '  for i = 1, #str do',
         '    local c = string.sub(str, i, i)',
         '    if inWord then',
         '      table.insert(buf, string.lower(c))',
         '      if string.find(c, "%s") then',
         '        inWord = false',
         '      end',
         '    else',
         '      table.insert(buf, string.upper(c))',
         '      inWord = true',
         '    end',
         '  end',
         '  return table.concat(buf)',
         'end']);
  }
  var code = functionName + '(' + text + ')';
  return [code, Blockly.Lua.ORDER_HIGH];
};

Blockly.Lua['text_trim'] = function(block) {
  // Trim spaces.
  var OPERATORS = {
    LEFT: '^%s*(,-)',
    RIGHT: '(.-)%s*$',
    BOTH: '^%s*(.-)%s*$'
  };
  var operator = OPERATORS[block.getFieldValue('MODE')];
  var text = Blockly.Lua.valueToCode(block, 'TEXT',
      Blockly.Lua.ORDER_NONE) || '\'\'';
  var code = 'string.gsub(' + text + ', "' + operator + '", "%1")';
  return [code, Blockly.Lua.ORDER_HIGH];
};

Blockly.Lua['text_print'] = function(block) {
  // Print statement.
  var msg = Blockly.Lua.valueToCode(block, 'TEXT',
      Blockly.Lua.ORDER_NONE) || '\'\'';
  return 'print(' + msg + ')\n';
};

Blockly.Lua['text_prompt_ext'] = function(block) {
  // Prompt function.
  if (block.getField('TEXT')) {
    // Internal message.
    var msg = Blockly.Lua.quote_(block.getFieldValue('TEXT'));
  } else {
    // External message.
    var msg = Blockly.Lua.valueToCode(block, 'TEXT',
        Blockly.Lua.ORDER_NONE) || '\'\'';
  }

  var functionName = Blockly.Lua.provideFunction_(
      'text_prompt',
      ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_ + '(msg)',
       '  io.write(msg)',
       '  io.flush()',
       '  return io.read()',
       'end']);
  var code = functionName + '(' + msg + ')';

  var toNumber = block.getFieldValue('TYPE') == 'NUMBER';
  if (toNumber) {
    code = 'tonumber(' + code + ', 10)';
  }
  return [code, Blockly.Lua.ORDER_HIGH];
};

Blockly.Lua['text_prompt'] = Blockly.Lua['text_prompt_ext'];

Blockly.Lua['text_count'] = function(block) {
  var text = Blockly.Lua.valueToCode(block, 'TEXT',
      Blockly.Lua.ORDER_NONE) || '\'\'';
  var sub = Blockly.Lua.valueToCode(block, 'SUB',
      Blockly.Lua.ORDER_NONE) || '\'\'';
  var functionName = Blockly.Lua.provideFunction_(
      'text_count',
      ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_
        + '(haystack, needle)',
        '  if #needle == 0 then',
        '    return #haystack + 1',
        '  end',
        '  local i = 1',
        '  local count = 0',
        '  while true do',
        '    i = string.find(haystack, needle, i, true)',
        '    if i == nil then',
        '      break',
        '    end',
        '    count = count + 1',
        '    i = i + #needle',
        '  end',
        '  return count',
        'end',
      ]);
  var code = functionName + '(' + text + ', ' + sub + ')';
  return [code, Blockly.Lua.ORDER_HIGH];
};

Blockly.Lua['text_replace'] = function(block) {
  var text = Blockly.Lua.valueToCode(block, 'TEXT',
      Blockly.Lua.ORDER_NONE) || '\'\'';
  var from = Blockly.Lua.valueToCode(block, 'FROM',
      Blockly.Lua.ORDER_NONE) || '\'\'';
  var to = Blockly.Lua.valueToCode(block, 'TO',
      Blockly.Lua.ORDER_NONE) || '\'\'';
  var functionName = Blockly.Lua.provideFunction_(
      'text_replace',
      ['function ' + Blockly.Lua.FUNCTION_NAME_PLACEHOLDER_
        + '(haystack, needle, replacement)',
        '  local buf = {}',
        '  local i = 1',
        '  while i <= #haystack do',
        '    if string.sub(haystack, i, i + #needle - 1) == needle then',
        '      for j = 1, #replacement do',
        '        table.insert(buf, string.sub(replacement, j, j))',
        '      end',
        '      i = i + #needle',
        '    else',
        '      table.insert(buf, string.sub(haystack, i, i))',
        '      i = i + 1',
        '    end',
        '  end',
        '  return table.concat(buf)',
        'end',
      ]);
  var code = functionName + '(' + text + ', ' + from + ', ' + to + ')';
  return [code, Blockly.Lua.ORDER_HIGH];
};

Blockly.Lua['text_reverse'] = function(block) {
  var text = Blockly.Lua.valueToCode(block, 'TEXT',
      Blockly.Lua.ORDER_HIGH) || '\'\'';
  var code = 'string.reverse(' + text + ')';
  return [code, Blockly.Lua.ORDER_HIGH];
};
/**
 * @license
 * Copyright 2016 Google LLC
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
 * @fileoverview Generating Lua for variable blocks.
 * @author rodrigoq@google.com (Rodrigo Queiro)
 */
'use strict';

goog.provide('Blockly.Lua.variables');

goog.require('Blockly.Lua');


Blockly.Lua['variables_get'] = function(block) {
  // Variable getter.
  var code = Blockly.Lua.variableDB_.getName(block.getFieldValue('VAR'),
      Blockly.VARIABLE_CATEGORY_NAME);
  return [code, Blockly.Lua.ORDER_ATOMIC];
};

Blockly.Lua['variables_set'] = function(block) {
  // Variable setter.
  var argument0 = Blockly.Lua.valueToCode(block, 'VALUE',
      Blockly.Lua.ORDER_NONE) || '0';
  var varName = Blockly.Lua.variableDB_.getName(
      block.getFieldValue('VAR'), Blockly.VARIABLE_CATEGORY_NAME);
  return varName + ' = ' + argument0 + '\n';
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
 * @fileoverview Generating Lua for dynamic variable blocks.
 * @author fenichel@google.com (Rachel Fenichel)
 */
'use strict';

goog.provide('Blockly.Lua.variablesDynamic');

goog.require('Blockly.Lua');
goog.require('Blockly.Lua.variables');


// Lua is dynamically typed.
Blockly.Lua['variables_get_dynamic'] = Blockly.Lua['variables_get'];
Blockly.Lua['variables_set_dynamic'] = Blockly.Lua['variables_set'];
