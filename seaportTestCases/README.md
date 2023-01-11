1. 安装库文件: 进入到seaportTestCases文件夹下，运行以下命令

   ```cmd
   npm i
   ```

2. 设置测试地址私钥，打开setting.js， 填上卖家和买家的私钥

   const privKey01 = ""
   const privKey02 = ""

3. 设置UD_TOKEN_ID和手续费接收地址feeAddr

   const UD_TOKEN_ID = "33651723785549494707706199451737364537114120588167476828772376849918637234177";  
   
   const feeAddr = "0xE9c273E205dd99C1C2Eea66f0cb7655cDFB1AE41";

设置好后，运行npx hardhat test test/xxxx.js

其中customised开头的脚本，代表自定义手续费地址，opensea开头的脚本是在opensea直接上架和购买，batch-orders-params-algorithm.js 是提供给前端的批量购买参数算法

