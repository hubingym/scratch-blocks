# scratch-blocks

ES6 import + 调试时可以看到源码

## 主要目的

1. 调试的时候可以看到源码，官方代码import导入的是压缩版本
2. 去掉对google-closure-compiler的依赖，因网络原因有时候无法编译成功

## 构建产出物

```bash
./build.sh
```

## 产出物简介

- blockly_vertical.js = closure-library/closure/goog(部分用得上的) + scratch-blocks/core

- blocks_vertical.js = scratch-blocks/blocks_common + scratch-blocks/blocks_vertical

- shim/vertical.js = blockly_vertical.js + blocks_vertical.js + msg/messages.js + msg/scratch_msgs.js

  注意：import 'scratch-blocks' 得到的入口文件是shim/vertical.js，导出的就是Blockly

## 如何与官方scratch-blocks同步代码

拉取最新的scratch-blocks的源码，使blocks_common、blocks_vertical、core、media、msg这几个目录下的代码相同，重新构建即可

注意：记得更新VERSION文件中的版本信息