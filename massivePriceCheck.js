const borsh = require("@project-serum/borsh");
const { Connection, PublicKey } = require("@solana/web3.js");
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const _ = require('lodash')

const { decodeMetadata } = require("./structure");
async function getMetadataAccount(nftAddress) {
    var address = (await PublicKey.findProgramAddress([Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), nftAddress.toBuffer()], TOKEN_METADATA_PROGRAM_ID))[0]
    return address
}
async function getParsedMetadata(connection, nftAddress) {
    var metaAddress = await getMetadataAccount(nftAddress)
    var data = (await connection.getAccountInfo(metaAddress)).data
    const metadata = decodeMetadata(data)
    return metadata
}
var coolDown = function (coolDownPeriod) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve()
        }, coolDownPeriod)
    })
}

const url = "https://solana--mainnet.datahub.figment.io/health:8899"
var connection = new Connection(url, { httpHeaders: { Authorization: '' }, wsEndpoint: "wss://solana--mainnet.datahub.figment.io/apikey/" })
// var connection = new Connection("https://api.mainnet-beta.solana.com")

async function massivePriceCheck() {
    var coolP=10//300
    var programIDSolanart = new PublicKey("CJsLwbP1iu5DuUikHEJnLfANgKy6stB2uFgvBBHoyxwz")
    var data_layout_solanartProgramAcc = borsh.struct([
        borsh.u8("isInit"),
        borsh.publicKey("walletOwner"),
        borsh.publicKey("mint"),
        borsh.u64("price")
    ])
    var data_layout_token = borsh.struct([
        borsh.publicKey("mint"),
        borsh.publicKey("owner"),
        borsh.u64("amount"),
    ])
    var accs = (await connection.getProgramAccounts(programIDSolanart))
    var listMint = accs.map((x) => {
        var liz = x
        var data = liz.account.data
        var decodedData = data_layout_solanartProgramAcc.decode(data)
        Object.keys(decodedData).map((x) => {
            decodedData[x] = decodedData[x].toString()
        })
        // console.log(decodedData)
        // return new PublicKey(decodedData.mint)
        return decodedData
    })
    var bigData = []
    var limit = 100//100 //asking for floor cost 5k requests since the maximum number of accounts querable is 100
    for (var i = 0; i < listMint.length; i += limit) {
        var cap = Math.min(i + limit, listMint.length)
        var Accs = listMint.slice(i, cap)
        var querableAccs = Accs.map((x) => { return new PublicKey(x.mint) })
        var bunchData = (await (await connection.getMultipleAccountsInfo(querableAccs))).map((x, i) => {
            try{
                var data = data_layout_token.decode(x.data)
                data.price = Number(Accs[i].price) * 0.000000001
                data.walletOwner = Accs[i].walletOwner
                Object.keys(data).map((x) => {
                    data[x] = data[x].toString()
                })
                return data
            }catch(e){}
        }).filter((x)=>{if(x)return x})
        bigData.push(...bunchData)
        await coolDown(coolP)
    }
    // console.log(bigData)

    var fullData = []
    
    for (var i = 0; i < bigData.length; i++) { //this instead will cost 55k requests
        try{
            var x = bigData[i]
            var meta = await getParsedMetadata(connection, new PublicKey(x.mint))
            x.metadata = meta.data
            fullData.push(x)
            await coolDown(coolP)
        }catch(e){}
    }
    

    var collectionNames = _.uniqBy(fullData.map((x) => {
        var w = {
            collecionName: x.metadata.name.split("-").shift().split("#").shift(),
        }
        if(w.collecionName!=""&&!w.collecionName.includes(",")&&!w.collecionName.includes("solchick")){
            return w
        }
    }),"collecionName").filter((x)=>{if(x)return x})

    for (var i = 0; i < fullData.length; i++) {
        for (var j = 0; j < collectionNames.length; j++) {
            if (fullData[i].metadata.name.includes(collectionNames[j].collecionName) && (!collectionNames[j].floor || Number(fullData[i].price) < collectionNames[j].floor)) {
                // var a = _.findIndex(collectionNames, { collecionName: collectionNames[j].collecionName })//collectionNames.indexOf(collectionNames[j])
                collectionNames[j].floor = Number(fullData[i].price)
            }
        }
    }
    console.log(collectionNames)
    var f=""
    for(var i=0;i<collectionNames.length;i++){
        f+=`\nFloor ${collectionNames[i].collecionName}: ${collectionNames[i].floor}`
    }
    console.log(f)
    return f
}

massivePriceCheck()