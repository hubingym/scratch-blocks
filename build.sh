# gen goog_all.js
cat goog/base.js \
    goog/object/object.js \
    goog/debug/debug.js \
    goog/debug/entrypointregistry.js \
    goog/debug/error.js \
    goog/debug/errorcontext.js \
    goog/debug/logbuffer.js \
    goog/debug/logger.js \
    goog/debug/logrecord.js \
    goog/disposable/disposable.js \
    goog/disposable/idisposable.js \
    goog/array/array.js \
    goog/functions/functions.js \
    goog/asserts/asserts.js \
    goog/async/animationdelay.js \
    goog/async/delay.js \
    goog/async/freelist.js \
    goog/async/nexttick.js \
    goog/async/workqueue.js \
    goog/async/run.js \
    goog/color/color.js \
    goog/color/names.js \
    goog/i18n/bidi.js \
    goog/i18n/datetimeformat.js \
    goog/i18n/datetimepatterns.js \
    goog/i18n/datetimesymbols.js \
    goog/i18n/timezone.js \
    goog/iter/iter.js \
    goog/date/date.js \
    goog/date/datelike.js \
    goog/date/daterange.js \
    goog/string/const.js \
    goog/string/string.js \
    goog/string/stringbuffer.js \
    goog/string/typedstring.js \
    goog/reflect/reflect.js \
    goog/labs/useragent/browser.js \
    goog/labs/useragent/engine.js \
    goog/labs/useragent/platform.js \
    goog/labs/useragent/util.js \
    goog/useragent/useragent.js \
    goog/useragent/platform.js \
    goog/useragent/product.js \
    goog/useragent/product_isversion.js \
    goog/dom/animationframe/polyfill.js \
    goog/dom/asserts.js \
    goog/dom/browserfeature.js \
    goog/dom/classlist.js \
    goog/dom/dom.js \
    goog/dom/htmlelement.js \
    goog/dom/tagiterator.js \
    goog/dom/nodeiterator.js \
    goog/dom/nodetype.js \
    goog/dom/safe.js \
    goog/dom/tagname.js \
    goog/dom/tags.js \
    goog/dom/vendor.js \
    goog/events/event.js \
    goog/events/browserevent.js \
    goog/events/browserfeature.js \
    goog/events/eventhandler.js \
    goog/events/eventid.js \
    goog/events/events.js \
    goog/events/listenable.js \
    goog/events/eventtarget.js \
    goog/events/eventtype.js \
    goog/events/focushandler.js \
    goog/events/keycodes.js \
    goog/events/keyhandler.js \
    goog/events/listener.js \
    goog/events/listenermap.js \
    goog/events/mousewheelhandler.js \
    goog/fs/url.js \
    goog/fx/transition.js \
    goog/fx/transitionbase.js \
    goog/fx/anim/anim.js \
    goog/fx/animation.js \
    goog/fx/animationqueue.js \
    goog/fx/dom.js \
    goog/fx/dragger.js \
    goog/html/safeurl.js \
    goog/html/safehtml.js \
    goog/html/safescript.js \
    goog/html/safestyle.js \
    goog/html/safestylesheet.js \
    goog/html/trustedresourceurl.js \
    goog/html/uncheckedconversions.js \
    goog/log/log.js \
    goog/math/box.js \
    goog/math/coordinate.js \
    goog/math/irect.js \
    goog/math/math.js \
    goog/math/rect.js \
    goog/math/size.js \
    goog/promise/thenable.js \
    goog/promise/promise.js \
    goog/promise/resolver.js \
    goog/structs/structs.js \
    goog/structs/trie.js \
    goog/style/bidi.js \
    goog/style/style.js \
    goog/timer/timer.js \
    goog/a11y/aria/roles.js \
    goog/a11y/aria/aria.js \
    goog/a11y/aria/attributes.js \
    goog/a11y/aria/datatables.js \
    goog/ui/idgenerator.js \
    goog/ui/controlrenderer.js \
    goog/ui/menuheaderrenderer.js \
    goog/ui/menuitemrenderer.js \
    goog/ui/menuseparatorrenderer.js \
    goog/ui/registry.js \
    goog/ui/component.js \
    goog/ui/control.js \
    goog/ui/palette.js \
    goog/ui/colorpalette.js \
    goog/ui/colorpicker.js \
    goog/ui/container.js \
    goog/ui/containerrenderer.js \
    goog/ui/controlcontent.js \
    goog/ui/datepicker.js \
    goog/ui/datepickerrenderer.js \
    goog/ui/defaultdatepickerrenderer.js \
    goog/ui/menurenderer.js \
    goog/ui/menu.js \
    goog/ui/menuheader.js \
    goog/ui/menuitem.js \
    goog/ui/separator.js \
    goog/ui/menuseparator.js \
    goog/ui/paletterenderer.js \
    goog/ui/rangemodel.js \
    goog/ui/selectionmodel.js \
    goog/ui/sliderbase.js \
    goog/ui/slider.js \
    goog/ui/tree/basenode.js \
    goog/ui/tree/treecontrol.js \
    goog/ui/tree/treenode.js \
    goog/ui/tree/typeahead.js > goog_all.js

# gen blockly_vertical_with_comments.js
cat goog_all.js \
    core/blockly.js \
    core/block.js \
    core/block_svg.js \
    core/block_render_svg_vertical.js \
    core/block_animations.js \
    core/block_drag_surface.js \
    core/block_dragger.js \
    core/blocks.js \
    core/bubble_dragger.js \
    core/colours.js \
    core/connection.js \
    core/connection_db.js \
    core/constants.js \
    core/contextmenu.js \
    core/css.js \
    core/data_category.js \
    core/dragged_connection_manager.js \
    core/dropdowndiv.js \
    core/extensions.js \
    core/field.js \
    core/field_textinput.js \
    core/field_angle.js \
    core/field_checkbox.js \
    core/field_colour.js \
    core/field_colour_slider.js \
    core/field_date.js \
    core/field_dropdown.js \
    core/field_iconmenu.js \
    core/field_image.js \
    core/field_label.js \
    core/field_label_serializable.js \
    core/field_matrix.js \
    core/field_note.js \
    core/field_number.js \
    core/field_textdropdown.js \
    core/field_numberdropdown.js \
    core/field_textinput_removable.js \
    core/field_variable.js \
    core/field_variable_getter.js \
    core/field_vertical_separator.js \
    core/flyout_base.js \
    core/flyout_vertical.js \
    core/flyout_button.js \
    core/flyout_extension_category_header.js \
    core/generator.js \
    core/gesture.js \
    core/grid.js \
    core/inject.js \
    core/input.js \
    core/insertion_marker_manager.js \
    core/names.js \
    core/options.js \
    core/procedures.js \
    core/rendered_connection.js \
    core/scratch_blocks_utils.js \
    core/bubble.js \
    core/scratch_bubble.js \
    core/variable_map.js \
    core/variable_model.js \
    core/variables.js \
    core/icon.js \
    core/comment.js \
    core/scratch_block_comment.js \
    core/mutator.js \
    core/warning.js \
    core/events.js \
    core/events_abstract.js \
    core/block_events.js \
    core/scratch_events.js \
    core/comment_events.js \
    core/ui_events.js \
    core/variable_events.js \
    core/msg.js \
    core/scratch_msgs.js \
    core/scrollbar.js \
    core/toolbox.js \
    core/tooltip.js \
    core/touch.js \
    core/trashcan.js \
    core/ui_menu_utils.js \
    core/utils.js \
    core/widgetdiv.js \
    core/workspace.js \
    core/workspace_audio.js \
    core/workspace_comment.js \
    core/workspace_comment_svg.js \
    core/workspace_comment_render_svg.js \
    core/workspace_drag_surface_svg.js \
    core/workspace_svg.js \
    core/workspace_dragger.js \
    core/flyout_dragger.js \
    core/zoom_controls.js \
    core/xml.js > blockly_vertical_with_comments.js

# delete goog_all.js
rm -f goog_all.js

# gen blockly_vertical.js
tsc --removeComments --allowJs -m none -t es5 --outFile blockly_vertical.js blockly_vertical_with_comments.js

# gen blockly_vertical.min.js
rollup -c rollup.blockly.config.js

# gen blocks_vertical.js
cat blocks_common/colour.js \
    blocks_common/math.js \
    blocks_common/matrix.js \
    blocks_common/note.js \
    blocks_common/text.js \
    blocks_vertical/control.js \
    blocks_vertical/data.js \
    blocks_vertical/event.js \
    blocks_vertical/extensions.js \
    blocks_vertical/looks.js \
    blocks_vertical/motion.js \
    blocks_vertical/operators.js \
    blocks_vertical/procedures.js \
    blocks_vertical/sensing.js \
    blocks_vertical/sound.js \
    blocks_vertical/default_toolbox.js \
    blocks_vertical/vertical_extensions.js > blocks_vertical.js

# gen shim/vertical.js
# cat extra/header.js \
#     blockly_vertical.js \
#     blocks_vertical.js \
#     msg/messages.js \
#     msg/scratch_msgs.js \
#     extra/footer.js > shim/vertical.js

# gen shim/vertical.min.js
# yarn rollup -c

#gen generator_javascript.js
cat generators/javascript.js \
    generators/javascript/colour.js \
    generators/javascript/lists.js \
    generators/javascript/logic.js \
    generators/javascript/loops.js \
    generators/javascript/math.js \
    generators/javascript/procedures.js \
    generators/javascript/text.js \
    generators/javascript/variables.js \
    generators/javascript/variables_dynamic.js > generator_javascript.js

#gen generator_python.js
cat generators/python.js \
    generators/python/colour.js \
    generators/python/lists.js \
    generators/python/logic.js \
    generators/python/loops.js \
    generators/python/math.js \
    generators/python/procedures.js \
    generators/python/text.js \
    generators/python/variables.js \
    generators/python/variables_dynamic.js > generator_python.js

#gen generator_dart.js
cat generators/dart.js \
    generators/dart/colour.js \
    generators/dart/lists.js \
    generators/dart/logic.js \
    generators/dart/loops.js \
    generators/dart/math.js \
    generators/dart/procedures.js \
    generators/dart/text.js \
    generators/dart/variables.js \
    generators/dart/variables_dynamic.js > generator_dart.js

#gen generator_lua.js
cat generators/lua.js \
    generators/lua/colour.js \
    generators/lua/lists.js \
    generators/lua/logic.js \
    generators/lua/loops.js \
    generators/lua/math.js \
    generators/lua/procedures.js \
    generators/lua/text.js \
    generators/lua/variables.js \
    generators/lua/variables_dynamic.js > generator_lua.js

#gen generator_php.js
cat generators/php.js \
    generators/php/colour.js \
    generators/php/lists.js \
    generators/php/logic.js \
    generators/php/loops.js \
    generators/php/math.js \
    generators/php/procedures.js \
    generators/php/text.js \
    generators/php/variables.js \
    generators/php/variables_dynamic.js > generator_php.js

# print infomation
cat VERSION
echo build successed!
