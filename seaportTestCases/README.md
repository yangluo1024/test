1. 安装库文件: 进入到seaportTestCases文件夹下，运行以下命令

   ```cmd
   npm i
   ```

2. 设置需要mock的地址及该地址下的UD_TOKEN_ID

   const mockAddress = "0xAa7739805C133F6eF0275638b3412af76F51777A";  
   
   const UD_TOKEN_ID = "33651723785549494707706199451737364537114120588167476828772376849918637234177";
   
   如果涉及weth支付订单，确保mockAddress地址中的实际weth余额大于0.0003(批量支付时需要付0.0002)
   
3. 设置好后，运行以下命令进行测试

   ```cmd
   # 启动本地节点
   npx hardhat node --fork https://rpc.ankr.com/polygon --hostname 0.0.0.0
   # 运行设置好的测试脚本
   npx hardhat test test/xxx.js --network localhost
   ```

   
