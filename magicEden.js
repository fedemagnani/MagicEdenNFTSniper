/* eslint-disable no-async-promise-executor */
/* eslint-disable no-inner-declarations */
/* eslint-disable no-control-regex */
/* eslint-disable no-empty */
/* eslint-disable no-redeclare */
/* eslint-disable no-unused-vars */
const { Connection, PublicKey, TransactionInstruction, Transaction, Keypair, sendAndConfirmTransaction } = require('@solana/web3.js');
const { Client, Intents, MessageEmbed } = require('discord.js');
const WebSocket = require('ws');
const cheerio = require('cheerio');
const fs = require('fs')
const path = require("path")
const { decodeMetadata } = require("./structure");
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const magicEdenAddress = "MEisE1HzehtrDpAAT8PnLHjpSSkRYakotTuJRPjTpo8"
const borsh = require('@project-serum/borsh')
const bs58 = require('bs58')
const DiscordWebhooks = require('./DiscordWebhooks');
const { indexOf, reject } = require('lodash');
const _ = require('lodash');
var request = require('request');
const util = require('util');
const { resolve } = require('path/posix');
const doesExistPath = util.promisify(fs.exists);
const makeDir = util.promisify(fs.mkdir)
const readFile = util.promisify(fs.readFile)

const discordWebHooks = new DiscordWebhooks()
const generalWebhook = ""
const errorWebhook = ""
const successWebhook = ""
const warningWebhook = ""
const successMeWebhook = ""
const ignoreWebhook = ""
//conviene mettere poca roba, perché le instruction data sono statiche e quindi se il prezzo nel mentre cambia, non si verificano errori di compilazione
const arrayPvtKey = []
const wally = Keypair.fromSecretKey(new Uint8Array(arrayPvtKey))

var attivo = true
var pastTxs = [{ signature: null }]
var problemaMagicEden = false
var problemaMagicEdenCall = false
var subscriptionID
const coolDownPeriodError = 100
var filtroVolumeH24 = true // usa il filtro delle 24 ore > 0
var sogliaVolume = 350 //in solana
var limiteTransazioniPrese = 10
var collezioniTrovate = JSON.parse(fs.readFileSync(path.join(__dirname, "collezioniMagicEden.json")))
var nftListSniping = JSON.parse(fs.readFileSync(path.join(__dirname, "nftSuME.json")))
var cachednftList = nftListSniping
var coolDownPeriodRequest = 0 //occhio al rateLimiting
var sogliaPerc = 0.5
const url = "https://solana--mainnet.datahub.figment.io/health:8899"

var coolDownPeriod = 250 //non viene usata nel websocket ma solo nel floor updater
var coolDownPeriodMonitorCall = 300
var altraPiattaforma = true
var venditeCounter = 0
var venditeCounter2 = 0
var startDate = new Date().toISOString().split("T")[0]
var startHour = new Date().toISOString().split("T")[1].split(".")[0]
var wsConnection1 = "wss://solana--mainnet.datahub.figment.io/apikey/"
// var wsConnection1 = "ws://api.mainnet-beta.solana.com"

var connection1 = new Connection(url, { httpHeaders: { Authorization: '' }, wsEndpoint: "wss://solana--mainnet.datahub.figment.io/apikey/", commitment: "confirmed" })
var connection1altra = new Connection(url, { httpHeaders: { Authorization: '' }, wsEndpoint: "wss://solana--mainnet.datahub.figment.io/apikey/", commitment: "confirmed" })
var connection3 = new Connection("https://solana-mainnet.gateway.pokt.network/v1/lb/")
var connection2 = new Connection("https://silent-smoke-181a.solanart.workers.dev/")
// var connectionRunNode = new Connection("https://connect.runnode.com/?apikey=VYb6J9YbvZ71zgm8J4Mz") //rate limitata sta merda
var connection = connection1
 
var usaConnessioneBuonaPerMandareTransazioneAcquisto = false
var usaConnessioneGratuitaPerMetadati = true
if(!usaConnessioneGratuitaPerMetadati){
    if(connection === connection1){
        connection2=connection1altra
    }else{
        connection2=connection1
    }
}
var filtroPrezziPezzenti = false
var sogliaFiltroPezzente = 0.1

var blacklist = ["CRACKED_&_GenoS3ck8xbDvYEZ8RxMG3Ln2qcyoAN8CTeZuaWgAoEA","GTKT_&_Ef896VQS1tfMACgL5Ce1TR7JZhehkrtowCyZZyYv7SWn", "NTG_&_FnfPWx7nXj76REBNi5zLWUbuadrCrTDx5u9fytetgdjn", "_&_HHTcbLmSQoSFHFfhPH14KGBWTpQ8cvCgaLE5YrqPnSBx"]

var antiRugPullArray = []
var sogliaRug = 1
var delayRug = 60000
var blackDelay = 150000
const EventEmitter = require('events');

class MyEmitter extends EventEmitter { }
const myEmitter = new MyEmitter();
myEmitter.on('event', async (data) => {
    var ArrivedAt = new Date(Date.now()).toTimeString()
    if (attivo) {
        problemaMagicEden = false
    }
    try {
        var parseInformationsStart = performance.now()
        var logs = data.logs
        var isPotentialSaleInsertion = logs.indexOf("Program log: Instruction: SetAuthority") > -1
        if (!isPotentialSaleInsertion) {
            return
        }
        var signature = data.signature
        var tx = await connection.getTransaction(signature)
        if (!tx) {
            myEmitter.emit('event', data); //riesegui se non funziona
            return
        }
        var istruzioni = tx.transaction.message.instructions
        if (istruzioni.length === 0) {
            return
        }
        var encodedPrice = istruzioni.find(el => el.data /*&& el.data.includes("X5saNr")*/)
        if (!encodedPrice) {
            return
        }
        venditeCounter += 1
        encodedPrice = encodedPrice.data
        if (!bs58.decode(encodedPrice).toString("hex").includes("96d480ba74018371")) {
            return
        }
        var prezzo = getPriceFromInstructionData(encodedPrice)
        if (!prezzo || !tx.transaction.message.accountKeys || !tx.meta.preTokenBalances[0] || !tx.meta.preTokenBalances[0].mint) {
            return
        }
        var nftAddress = tx.meta.preTokenBalances[0].mint
        var metadata = await getParsedMetadata(usaConnessioneGratuitaPerMetadati ? connection2 : connection, new PublicKey(nftAddress)) //chiediamo i metadati visto che non c'è un memo di riferimento, usando la connessione poraccia non rate-limitata
        if (!metadata) {
            return
        }
        var accountKeys = tx.transaction.message.accountKeys.map((x) => {
            return x.toString()
        })
        tx.transaction.message.accountKeys = accountKeys
        var dettagliCollezione = {
            nomeNftInCollezione: metadata.data.name,
            collezione: metadata.data.symbol,
            sellerFeeBasisPoint: metadata.data.sellerFeeBasisPoints,
            creators: metadata.data.creators,
        }
        var walletVenditore = accountKeys[0]
        var escrowPubkey = accountKeys[1]
        var escrowID = accountKeys[2]
        var indirizzoMetadati = await getMetadataAccount(new PublicKey(nftAddress))
        var inserzione = {
            nome: metadata.data.name,
            prezzo: prezzo,
            encodedPrice: bs58.decode(encodedPrice).toString("hex"),
            indirizzoNFT: metadata.mint,
            indirizzoMetadati: indirizzoMetadati.toString(),
            walletVenditore: walletVenditore,
            escrowPubkey: escrowPubkey,
            escrowID: escrowID,
            dettagliCollezione: dettagliCollezione,
        }
        if (!inserzione.dettagliCollezione.creators) {
            return
        }
        var buildCollezioneString = `${inserzione.dettagliCollezione.collezione}_&_${inserzione.dettagliCollezione.creators[0].address}`//`_&_${inserzione.dettagliCollezione.creators[0].address}`//creo gli id univoci usando solo indirizzo del primo creatore
        if (blacklist.indexOf(buildCollezioneString) > -1) {
            return
        }
        inserzione.buildCollezioneString = buildCollezioneString
        inserzione.dataAcquisto = costruisciDataAcquisto(inserzione.encodedPrice, inserzione.indirizzoNFT)
        var parseInformationsEnd = performance.now()
        var findGoodNftStart = performance.now()
        var nelMirino = _.sortBy(nftListSniping.filter(x => x.collezione === inserzione.buildCollezioneString), ["floorPrice"])[0]
        var isNotPezzente = true
        try {
            nelMirino.soglia = nelMirino.floorPrice * sogliaPerc
            inserzione.soglia = nelMirino.soglia
        } catch (e) { }
        if (nelMirino && filtroPrezziPezzenti) {
            isNotPezzente = Number(nelMirino.floorPrice) > sogliaFiltroPezzente
            if (!isNotPezzente && nelMirino && nelMirino.volumeAll > sogliaVolume && (filtroVolumeH24 ? nelMirino.volume24hr > 0 : true) && Number(inserzione.prezzo) <= nelMirino.soglia) {
                discordWebHooks.sendWarning(generalWebhook, `Ho trovato ${inserzione.nome} a ${inserzione.prezzo} (soglia: ${nelMirino.soglia}; floor price: ${nelMirino.floorPrice}, ma se flippa a pochi spicci perché il floor è sotto la soglia di ${sogliaFiltroPezzente}); SKIPPO`)
            }
        }
        console.log(inserzione)
        if (isNotPezzente && nelMirino && nelMirino.volumeAll > sogliaVolume && (filtroVolumeH24 ? nelMirino.volume24hr > 0 : true) && Number(inserzione.prezzo) <= nelMirino.soglia) {
            var findGoodNftEnd = performance.now()
            var sendSignStart = performance.now()
            var scammy = antiRugPullArray.find(el => el.collezione === inserzione.buildCollezioneString)
            if (scammy && scammy.nome != inserzione.nome) {
                var i = antiRugPullArray.indexOf(scammy)
                var newScammy = {
                    collezione: antiRugPullArray[i].collezione,
                    nome: inserzione.nome,
                    numero: antiRugPullArray[i].numero + 1,
                    timestamp: antiRugPullArray[i].nuovaApparizione,
                    nuovaApparizione: Date.now()
                }
                newScammy.differenza = newScammy.nuovaApparizione - newScammy.timestamp
                antiRugPullArray.splice(i, 1)
                antiRugPullArray = [...antiRugPullArray, newScammy]
                discordWebHooks.sendMessage(generalWebhook, `Lista RUG: ${JSON.stringify(antiRugPullArray)}`)
                if (newScammy.numero > sogliaRug) {
                    discordWebHooks.sendWarning(warningWebhook, `Possibile rug pull per ${inserzione.nome}!`)
                    return
                }
            } else {
                var antirugObject = {
                    collezione: inserzione.buildCollezioneString,
                    nome: inserzione.nome,
                    numero: 1,
                    timestamp: Date.now(),
                    nuovaApparizione: Date.now(),
                }
                antiRugPullArray.push(antirugObject)
            }
            try{
                var cc = 0
                while(cc<5){
                    myEmitter.emit('compracompra', inserzione);
                    cc++;
                }
                console.log(inserzione)
                discordWebHooks.sendMessage(generalWebhook, `Ho trovato un pezzo niente male su Magic Eden: ${inserzione.nome} a ${inserzione.prezzo} (soglia: ${nelMirino.soglia}; floor price: ${nelMirino.floorPrice})`)
            }catch(e){}
            var sendSignEnd = performance.now()
            try {
                var w = {
                    type: "Websocket (ME)",
                    ArrivedAt: ArrivedAt,
                    escrowPubkey: inserzione.escrowPubkey,
                    parseInformations: (parseInformationsEnd - parseInformationsStart) / 1000,
                    findGoodNft: (findGoodNftEnd - findGoodNftStart) / 1000,
                    sendSign: (sendSignEnd - sendSignStart) / 1000,
                    total: (parseInformationsEnd - parseInformationsStart) / 1000 + (findGoodNftEnd - findGoodNftStart) / 1000 + (sendSignEnd - sendSignStart) / 1000
                }
                discordWebHooks.timestampsTask(generalWebhook, w)
            } catch (e) { }
        }

    } catch (e) {
        problemaMagicEden = true
        console.log(e)
        try {
            discordWebHooks.errorLogsME(errorWebhook, e)
        } catch (e) { console.log(e) }
    }
});

myEmitter.on('compracompra',async(inserzione)=>{
    try {
        var sign = await MEbuyOnChain(arrayPvtKey, inserzione)
        if (sign) {
            discordWebHooks.newBuyOnChainME(successMeWebhook, sign)
        }
    } catch (e) {
        discordWebHooks.errorLogs(errorWebhook, e)
    }
})

function coolDown(coolDownPeriod) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve()
        }, coolDownPeriod)
    })
}

function almenoUnoPresente(stringa, arrayParoleDaCercare) {
    let trov = false
    for (var z = 0; z < arrayParoleDaCercare.length; z++) {
        if (stringa.includes(arrayParoleDaCercare[z])) {
            trov = true
        }
    }
    return trov
}

function twirlTimer() {
    var P = ["\\", "|", "/", "-"];
    var x = 0;
    return setInterval(function () {
        process.stdout.write("\r" + P[x++]);
        x &= 3;
    }, 250);
}

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

async function escrowStatsRPC(collectionName) {
    return new Promise((resolve) => {
        var options = {
            'method': 'GET',
            'url': `https://api-mainnet.magiceden.io/rpc/getCollectionEscrowStats/${collectionName}?nowait=true`,
            'headers': {
                'authority': 'api-mainnet.magiceden.io',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36'
            }
        };
        request(options, function (error, response) {
            try {
                if (error) throw new Error(error);
                var result = JSON.parse(response.body).results
                // console.log(response.headers['x-ratelimit-remaining'])
                if (response.statusCode != 200) {
                    console.log(response.statusCode)
                }
                var w = {
                    symbol: result.symbol,
                    name: result.name,
                    listedCount: result.listedCount,
                    floorPrice: result.floorPrice * 0.000000001,
                    avgPrice24hr: result.avgPrice24hr * 0.000000001,
                    volume24hr: Number(result.volume24hr) * 0.000000001,
                    volumeAll: result.volumeAll * 0.000000001
                }
                w.soglia = w.floorPrice * sogliaPerc
                resolve(w)
            } catch (e) {
                resolve(null)
            }
        });
    })

}

async function getMintAndFirstCreatorRPC(collectionName) {
    var encodedData = encodeURIComponent(`{"$match":{"collectionSymbol":"${collectionName}"},"$sort":{"takerAmount":1,"createdAt":-1},"$skip":0,"$limit":20}`)
    return new Promise((resolve) => {
        var options = {
            'method': 'GET',
            'url': `https://api-mainnet.magiceden.io/rpc/getListedNFTsByQuery?nowait=true&q=${encodedData}`,
            'headers': {
                'authority': 'api-mainnet.magiceden.io',
                'accept': 'application/json, text/plain, */*',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36',
                'origin': 'https://magiceden.io',
                'referer': 'https://magiceden.io/'
            }
        };
        request(options, function (error, response) {
            try {
                if (error) throw new Error(error);
                if (response.statusCode != 200) {
                    console.log(response.statusCode)
                }
                var nft = JSON.parse(response.body).results.shift()
                if (!nft) throw new Error(error);
                if (!nft.creators) throw new Error(error);
                var address = nft.mintAddress
                var firstcreator = nft.creators.shift().address
                resolve([address, firstcreator])
            } catch (e) {
                resolve([null, null])
            }
        });
    })
}

async function massivePriceCheckEndpoint(show) {
    var connection = connection2 //connessione poraccia non rate-limitata
    try {
        var richiesteTotali = 0
        var start = performance.now()
        return new Promise((resolve, reject) => {
            var options = {
                'method': 'GET',
                'url': 'https://api-mainnet.magiceden.io/all_collections?nowait=true',
                'headers': {
                }
            };
            request(options, function (error, response) {
                try {
                    if (error) throw new Error(error);
                    var nomiCollezione = JSON.parse(response.body).collections.map((x) => { return x.symbol }).filter((x) => { if (x) return x })
                    resolve(nomiCollezione)
                } catch (e) { reject(e) }
            });
        })
            .then((nomiCollezione) => {
                return new Promise(async (resolve) => {
                    var allData = []//floors, avgP 24h, vol 2h
                    async function push(i) {
                        var d = await escrowStatsRPC(nomiCollezione[i])
                        if (d) {
                            var [address, firstcreator] = await getMintAndFirstCreatorRPC(nomiCollezione[i])
                            // var collectionMetadataName = (await getParsedMetadata(connection2,new PublicKey(address))).data.symbol
                            // d.symbolAnd1Creator = `${collectionMetadataName}_&_${firstcreator}`
                            if (address && firstcreator) {
                                d.address = address
                                d.metadataAccount = await getMetadataAccount(new PublicKey(address))
                                d.firstcreator = firstcreator
                                if (show) {
                                    console.log(`${i + 1}/${nomiCollezione.length}`)
                                }
                                allData.push(d)
                            }
                        }
                    }
                    for (var i = 0; i < nomiCollezione.length; i++) {
                        try {
                            await push(i)
                            await coolDown(coolDownPeriodRequest)
                        } catch (e) { }
                    }
                    allData = allData.filter((x) => { if (x) return x })
                    var limit = 100
                    var finalBigData = []
                    for (var i = 0; i < allData.length; i += Math.min(limit, Math.max(Math.abs(allData.length - i - 1), 1))) {
                        richiesteTotali += 1
                        // console.log(`${i+1}/${allData.length}`)
                        var cap = Math.min(i + limit, allData.length - 1)
                        var Accs = allData.slice(i, cap)
                        var metadataAccounts = Accs.map((x) => { return new PublicKey(x.metadataAccount) })
                        var bunchData = (await connection.getMultipleAccountsInfo(metadataAccounts))
                        for (var z = 0; z < bunchData.length; z++) {
                            try {
                                var x = bunchData[z]
                                var data = decodeMetadata(x.data)
                                if (data.data.creators) {
                                    // Accs[z].metadata = data
                                    Accs[z].collezione = `${data.data.symbol}_&_${data.data.creators[0].address}` //`_&_${data.data.creators[0].address}`//
                                    Accs[z].timestamp = new Date(Date.now()).toTimeString()
                                    finalBigData.push(Accs[z])
                                }
                                // allData[indexOf(Accs, Accs[z])].metadata = data
                            } catch (e) {
                                console.log(e)
                                console.dir(Accs[z], { depth: null })
                            }
                        }
                        await coolDown(coolDownPeriod)
                    }
                    var end = performance.now()
                    discordWebHooks.sendMessage(ignoreWebhook, `Processo completato in ${(end - start) / 1000} secondi (richieste totali: ${richiesteTotali})`)
                    try {
                        fs.writeFileSync(path.join(__dirname, "nftSuME.json"), JSON.stringify(finalBigData))
                    } catch (e) { }
                    resolve(finalBigData)
                })
            })
            .catch((e) => {
                discordWebHooks.sendWarning(warningWebhook, "Non sono riuscito a prendere i nomi delle collezioni su Magic Eden")
                return null
            })
    } catch (e) {
        discordWebHooks.errorLogs(errorWebhook, e)
    }
}

function groupBySymbolAnd1Creator(array, key1) {
    // Return the end result
    return array.reduce((result, currentValue) => {
        (result[currentValue[key1]] = result[currentValue[key1]] || []).push(
            currentValue
        );
        return result;
    }, {});
}

async function massivePriceCheck() {
    var connection = connection2 //usiamo la connessione demme pe fa sto lavoro: se crasha mandiamo in catch e rifacciamo all'iterazione successiva
    try {
        var start = performance.now()
        var programIDSolanart = new PublicKey("MEisE1HzehtrDpAAT8PnLHjpSSkRYakotTuJRPjTpo8")
        var accs = (await connection.getProgramAccounts(programIDSolanart))
        var data_layout_solanartProgramAcc = borsh.struct([
            borsh.u64("nonSoCheE"),
            borsh.publicKey("owner"),
            borsh.publicKey("escrowID"),
            borsh.u64("price"),
        ])
        const dataLayout = borsh.struct([
            borsh.publicKey("initializerKey"),
            borsh.publicKey("initializerDepositTokenAccount"),
            borsh.u64("takerAmount")
        ]);
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
        // listMint=_.differenceBy(listMint,bigDataEscrow,"escrowID")
        var limit = 100//100 //asking for floor cost 5k requests since the maximum number of accounts querable is 100
        var richiesteTotali = 0
        var bigDataEscrow = []
        for (var i = 0; i < listMint.length; i += Math.min(limit, Math.max(Math.abs(listMint.length - i - 1), 1))) {
            richiesteTotali += 1
            // console.log(`${i+1}/${listMint.length}`)
            var cap = Math.min(i + limit, listMint.length - 1)
            var Accs = listMint.slice(i, cap)
            var querableAccs = Accs.map((x) => { return new PublicKey(x.escrowID) })
            var bunchData = (await connection.getMultipleAccountsInfo(querableAccs))
            var bunchData2 = []
            for (var z = 0; z < bunchData.length; z++) {
                try {
                    var x = bunchData[z]
                    var data = dataLayout.decode(x.data)
                    data.mint = data.initializerKey
                    data.metadataAccount = await getMetadataAccount(new PublicKey(data.mint))
                    var firstLayerData = Accs.find(el => el.escrowID === querableAccs[z].toString())
                    data.floorPrice = Number(firstLayerData.price) * 0.000000001
                    data.escrowID = firstLayerData.escrowID
                    Object.keys(data).map((x) => {
                        data[x] = data[x].toString()
                    })
                    bunchData2.push(data)
                } catch (e) {
                    // console.log(e) //alcuni account figli di MEis non sono escrowaccount, per questo ritornano null
                }
            }
            bigDataEscrow.push(...bunchData2)
            await coolDown(coolDownPeriod)
        }
        //una volta che hai i metdata accounts, chiedigli le info di quegli account cento alla volta, una volta che hai tutti i dati fa il decode dei metadata con metaplex e abbinagli il prezzo corrispondente
        //stesso ciclo for di prima ma con bigdataEscrow
        var finalBigData = []
        for (var i = 0; i < bigDataEscrow.length; i += Math.min(limit, Math.max(Math.abs(bigDataEscrow.length - i - 1), 1))) {
            // console.log(`${i+1}/${bigDataEscrow.length}`)
            richiesteTotali += 1
            var cap = Math.min(i + limit, bigDataEscrow.length - 1)
            var Accs = bigDataEscrow.slice(i, cap)
            var metadataAccounts = Accs.map((x) => { return new PublicKey(x.metadataAccount) })
            var bunchData = (await connection.getMultipleAccountsInfo(metadataAccounts))
            for (var z = 0; z < bunchData.length; z++) {
                try {
                    var x = bunchData[z]
                    var data = decodeMetadata(x.data)
                    if (data.data.creators) {
                        Accs[z].metadata = data
                        Accs[z].symbolAnd1Creator = `${data.data.symbol}_&_${data.data.creators[0].address}` //`_&_${data.data.creators[0].address}` // //creo gli id univoci usando solo indirizzo del primo creatore
                        finalBigData.push(Accs[z])
                    }

                    // bigDataEscrow[indexOf(Accs, Accs[z])].metadata = data
                } catch (e) {
                    console.log(e)
                    console.dir(Accs[z], { depth: null })
                }
            }
            await coolDown(coolDownPeriod)
        }
        var clusters = groupBySymbolAnd1Creator(finalBigData, "symbolAnd1Creator")
        var arrayOfClusters = []
        for (var i = 0; i < Object.keys(clusters).length; i++) {
            var justPrices = clusters[Object.keys(clusters)[i]].map((x) => { return Number(x.floorPrice) }).filter((x) => { if (x) return x })
            var lowest = Math.min.apply(null, justPrices)
            var w = {
                collezione: Object.keys(clusters)[i],
                floorPrice: lowest,
                nftsListed: clusters[Object.keys(clusters)[i]].length,
                cheapest: clusters[Object.keys(clusters)[i]].find(el => Number(el.floorPrice) === Number(lowest)).metadata.data.name,
                soglia: lowest * sogliaPerc
            }
            arrayOfClusters.push(w)

            // clusters[Object.keys(clusters)[i]].nts=clusters[Object.keys(clusters)[i]]
            // clusters[Object.keys(clusters)[i]].floorPrice=Math.min(clusters[Object.keys(clusters)[i]].nts.map((x)=>{return Number(x.floorPrice)}))
        }
        var end = performance.now()
        discordWebHooks.sendMessage(ignoreWebhook, `Processo completato in ${(end - start) / 1000} secondi (richieste totali: ${richiesteTotali})`)
        try {
            fs.writeFileSync(path.join(__dirname, "nftSuME.json"), JSON.stringify(arrayOfClusters))
        } catch (e) { }
        return arrayOfClusters
    } catch (e) {
        console.log(e)
    }
}

async function decodeEscrowAccountData(escrowAccount) { //string: puoi ottenere l'escrow account andando su 
    // var sellerAdd = await connection.getTokenAccountsByOwner(new PublicKey("GUfCR9mK6azb9vcpsxgXyj7XRPAKJd4KMHTTVvtncGgp"),{mint:new PublicKey("HbJHGSfMYmRDuA3bKzpxStbXAAzkpvwbmv9wUEpqjGXh")})
    var data = (await connection.getAccountInfo(new PublicKey(escrowAccount))).data
    const dataLayout = borsh.struct([
        borsh.publicKey("initializerKey"),
        borsh.publicKey("initializerDepositTokenAccount"),
        borsh.u64("takerAmount")
    ]);
    const t = dataLayout.decode(data)
    for (var i = 0; i < Object.keys(t).length; i++) {
        t[Object.keys(t)[i]] = Object.values(t)[i].toString()
    }

    console.log((t))
}

async function getPriceFromEscrow(escrowPubkey) {
    var data_layout_solanartProgramAcc = borsh.struct([
        borsh.u64("nonSoCheE"),
        borsh.publicKey("owner"),
        borsh.publicKey("escrowID"),
        borsh.u64("price"),
    ])
    var escrowPubkeyEncodedData = (await connection.getAccountInfo(new PublicKey(escrowPubkey))).data
    const t = data_layout_solanartProgramAcc.decode(escrowPubkeyEncodedData)
    for (var i = 0; i < Object.keys(t).length; i++) {
        t[Object.keys(t)[i]] = Object.values(t)[i].toString()
    }
    var escrowID = t.escrowID
    var owner = t.owner
    var price = t.price * 0.000000001
    return price
}

function getPriceFromInstructionData(base58Data) {  //Returns the price in sol
    const bytes = bs58.decode(base58Data)
    const dataLayout = borsh.struct([
        borsh.u64("nonSoCheE"),
        borsh.u64("amount")
    ]);
    const t = dataLayout.decode(bytes)

    for (var i = 0; i < Object.keys(t).length; i++) {
        t[Object.keys(t)[i]] = Object.values(t)[i].toString()
    }
    return Number(t.amount.toString()) * 0.000000001
}

async function MEaddInstructionsForBuyingNFT(transaction, walletAcquirente, escrowID, walletVenditore, escrowPubkey, indirizzoMetadati, indirizziCreatori, dataAcquisto) {
    //wallet acquirente
    //escrowID //token address di GUfCR9mK6azb9vcpsxgXyj7XRPAKJd4KMHTTVvtncGgp del mint
    //wallet venditore
    //escrowPubkey
    //GUfCR9mK6azb9vcpsxgXyj7XRPAKJd4KMHTTVvtncGgp
    //system program
    //token program
    //2NZukH2TXpcuZP4htiuT8CFxcaQSWzkkR6kepSWnZ24Q
    //indirizzo metadati
    //...indirizzi creatori
    //data: 2f031b61d7ecdb90
    var indirizzoSconosciuto1 = "GUfCR9mK6azb9vcpsxgXyj7XRPAKJd4KMHTTVvtncGgp"
    var systemProgram = "11111111111111111111111111111111"
    var tokenProgram = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
    var indirizzoSconosciuto2 = "2NZukH2TXpcuZP4htiuT8CFxcaQSWzkkR6kepSWnZ24Q"
    var dataInstrutionInHex = "2f031b61d7ecdb90"
    var programId = "MEisE1HzehtrDpAAT8PnLHjpSSkRYakotTuJRPjTpo8"
    if (dataAcquisto) {
        dataInstrutionInHex = dataAcquisto
    }
    var dataInstruction2Buffered = Buffer.from(dataInstrutionInHex, 'hex')
    var instructions = new TransactionInstruction({
        data: dataInstruction2Buffered,
        keys: [
            {
                pubkey: new PublicKey(walletAcquirente),
                isSigner: true,
                isWritable: true
            },
            {
                pubkey: new PublicKey(escrowPubkey),
                isSigner: false,
                isWritable: true
            },
            {
                pubkey: new PublicKey(walletVenditore),
                isSigner: false,
                isWritable: true
            },
            {
                pubkey: new PublicKey(escrowID),
                isSigner: false,
                isWritable: true
            },
            {
                pubkey: new PublicKey(indirizzoSconosciuto1),
                isSigner: false,
                isWritable: false
            },
            {
                pubkey: new PublicKey(systemProgram),
                isSigner: false,
                isWritable: false
            },
            {
                pubkey: new PublicKey(tokenProgram),
                isSigner: false,
                isWritable: false
            },
            {
                pubkey: new PublicKey(indirizzoSconosciuto2),
                isSigner: false,
                isWritable: true
            },
            {
                pubkey: new PublicKey(indirizzoMetadati),
                isSigner: false,
                isWritable: false
            }
        ],
        programId: new PublicKey(programId)
    })
    for (var i = 0; i < indirizziCreatori.length; i++) {
        var w = {
            pubkey: new PublicKey(indirizziCreatori[i]),
            isSigner: false,
            isWritable: true
        }
        instructions.keys.push(w)
    }
    return transaction.add(instructions)
}

async function MEbuyOnChain(arrayPvtKey, inserzione) {
    const privateKeyuint8 = new Uint8Array(arrayPvtKey)
    const mioWallet = Keypair.fromSecretKey(privateKeyuint8)
    console.log(mioWallet.publicKey.toString())
    const walletAcquirente = mioWallet.publicKey.toString() //Prendiamo l'inidirizzo visibile del wallet
    var transaction = new Transaction()
    var escrowID = inserzione.escrowID
    var walletVenditore = inserzione.walletVenditore
    var escrowPubkey = inserzione.escrowPubkey
    var indirizzoMetadati = inserzione.indirizzoMetadati
    var dataAcquisto = inserzione.dataAcquisto
    var indirizziCreatori = inserzione.dettagliCollezione.creators.map((x) => {
        return x.address
    })
    transaction = await MEaddInstructionsForBuyingNFT(transaction, walletAcquirente, escrowID, walletVenditore, escrowPubkey, indirizzoMetadati, indirizziCreatori, dataAcquisto)
    try {
        console.dir(transaction, { depth: null })
        var c = connection
        if (usaConnessioneBuonaPerMandareTransazioneAcquisto) {
            c = connection1
        }
        const signature = await sendAndConfirmTransaction(c, transaction, [mioWallet])
        console.log(signature)
        return signature
    } catch (e) {
        console.log(e)
        discordWebHooks.errorLogs(errorWebhook, e)
    }
    try { discordWebHooks.sendMessage(JSON.stringify(transaction)) } catch (e) { }
}

function costruisciDataAcquisto(encodedPrice, indirizzoNFT) {
    try {
        var a = "438e36d81f1d1b5c"
        var dataInHex = encodedPrice.replace("96d480ba74018371", "")
        dataInHex = dataInHex.substr(0, dataInHex.length - 2)
        var b = dataInHex
        var c = new PublicKey(indirizzoNFT).toBuffer().toString("hex")
        var dataAcquisto = a + b + c
        return dataAcquisto
    } catch (e) {
        return null
    }
}

function monitor() { //per adesso usiamo il websocket per non entrare a gamba tesa sul rate limiting di figment, ma la soluzione migliore forse rimane il getConfirmedSignaturesForAddress2()
    const ws = new WebSocket(wsConnection1);
    ws.onopen = () => {
        ws.send(JSON.stringify(
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "logsSubscribe",
                "params": [
                    {
                        "mentions": [magicEdenAddress]
                    },
                    {
                        "commitment": "processed"
                    }
                ]
            }
        ));
    }
    ws.on("message", (evt) => {
        try {
            var data = JSON.parse(evt).params.result.value
            myEmitter.emit('event', data);
        } catch (e) { console.log(e) }
    })
    ws.onclose = function(){
        setTimeout(monitor, 1000);
    };
}

async function monitorCall() {
    // var connection = connection1
    while (attivo) {
        problemaMagicEdenCall = false
        try {
            var ArrivedAt = new Date(Date.now()).toTimeString()
            var getConfirmTransStart = performance.now()
            var memoTxs = await connection.getConfirmedSignaturesForAddress2(new PublicKey(magicEdenAddress), { limit: limiteTransazioniPrese })
            var newTXs = []
            if (pastTxs.length > 0) {
                newTXs = _.differenceBy(memoTxs, pastTxs, 'signature')
            }
            pastTxs = memoTxs
            if (newTXs.length === 0) {
                continue
            }
            var soloSignatures = newTXs.map((x) => {
                return x.signature
            })
            var transazioniParsate = await connection.getParsedConfirmedTransactions(soloSignatures)
            var getConfirmTransEnd = performance.now()
            var parseInformationsStart = performance.now()
            for (var i = 0; i < transazioniParsate.length; i++) {
                var tx = transazioniParsate[i]
                if (!tx) {
                    continue
                }
                var istruzioni = tx.transaction.message.instructions
                if (istruzioni.length === 0) {
                    continue
                }
                var encodedPrice = istruzioni.find(el => el.data /*&& el.data.includes("X5saNr")*/)
                if (!encodedPrice) {
                    continue
                }
                venditeCounter2 += 1
                encodedPrice = encodedPrice.data
                if (!bs58.decode(encodedPrice).toString("hex").includes("96d480ba74018371")) {
                    continue
                }
                var prezzo = getPriceFromInstructionData(encodedPrice)
                if (!prezzo || !tx.transaction.message.accountKeys || !tx.meta.preTokenBalances[0] || !tx.meta.preTokenBalances[0].mint) {
                    continue
                }
                var nftAddress = tx.meta.preTokenBalances[0].mint
                var metadata = await getParsedMetadata(usaConnessioneGratuitaPerMetadati ? connection2 : connection, new PublicKey(nftAddress)) //chiediamo i metadati visto che non c'è un memo di riferimento, usando la connessione poraccia non rate-limitata
                if (!metadata) {
                    continue
                }
                if (tx.transaction.message.accountKeys.length === 0 || !tx.transaction.message.accountKeys.find(el => el.pubkey)) {
                    continue
                }
                var accountKeys = tx.transaction.message.accountKeys.map((x) => {
                    return x.pubkey.toString()
                })
                tx.transaction.message.accountKeys = accountKeys
                var nomeNftInCollezione = ""
                var includeAsterisco = metadata.data.name.includes("#")
                if (includeAsterisco) {
                    nomeNftInCollezione = metadata.data.name.split("#")[0]
                } else if (metadata.data.name.includes(" ")) {
                    for (var i = 0; i < (metadata.data.name.split(" ")).length - 1; i++) {
                        nomeNftInCollezione += (metadata.data.name.split(" ")[i]) + " "
                    }
                } else {
                    nomeNftInCollezione = metadata.data.name
                }
                var dettagliCollezione = {
                    nomeNftInCollezione: nomeNftInCollezione,
                    collezione: metadata.data.symbol,
                    sellerFeeBasisPoint: metadata.data.sellerFeeBasisPoints,
                    creators: metadata.data.creators,
                }
                var walletVenditore = accountKeys[0]
                var escrowPubkey = accountKeys[1]
                var escrowID = accountKeys[2]
                var indirizzoMetadati = await getMetadataAccount(new PublicKey(nftAddress))
                var inserzione = {
                    nome: metadata.data.name,
                    prezzo: prezzo,
                    encodedPrice: bs58.decode(encodedPrice).toString("hex"),
                    indirizzoNFT: metadata.mint,
                    indirizzoMetadati: indirizzoMetadati.toString(),
                    walletVenditore: walletVenditore,
                    escrowPubkey: escrowPubkey,
                    escrowID: escrowID,
                    dettagliCollezione: dettagliCollezione,
                }
                if (!inserzione.dettagliCollezione.creators) {
                    continue
                }
                var buildCollezioneString = `${inserzione.dettagliCollezione.collezione}_&_${inserzione.dettagliCollezione.creators[0].address}`//`_&_${inserzione.dettagliCollezione.creators[0].address}`////creo gli id univoci usando solo indirizzo del primo creatore
                if (blacklist.indexOf(buildCollezioneString) > -1) {
                    continue
                }
                inserzione.buildCollezioneString = buildCollezioneString
                inserzione.dataAcquisto = costruisciDataAcquisto(inserzione.encodedPrice, inserzione.indirizzoNFT)
                try {
                    var inCollezione = collezioniTrovate.find(el => el.collezione === dettagliCollezione.collezione && el.sellerFeeBasisPoint === dettagliCollezione.sellerFeeBasisPoint/*&&el.creators===dettagliCollezione.creators*/)//indexOf(collezioniTrovate,dettagliCollezione)<0
                    if (!inCollezione) {
                        dettagliCollezione.rilevazioni = 1
                        dettagliCollezione.prezzoMinimo = inserzione.prezzo,
                            dettagliCollezione.prezzoMedio = inserzione.prezzo,
                            collezioniTrovate.push(dettagliCollezione)
                    } else {
                        var index = indexOf(collezioniTrovate, inCollezione)
                        collezioniTrovate[index].rilevazioni += 1
                        if (Number(inserzione.prezzo) < Number(collezioniTrovate[index].prezzoMinimo)) {
                            collezioniTrovate[index].prezzoMinimo = Number(inserzione.prezzo)
                        }
                        collezioniTrovate[index].prezzoMedio = (collezioniTrovate[index].prezzoMedio * ((collezioniTrovate[index].rilevazioni - 1) / collezioniTrovate[index].rilevazioni)) + (inserzione.prezzo * (1 / collezioniTrovate[index].rilevazioni))
                        collezioniTrovate[index].creators = dettagliCollezione.creators //in questo modo aggiorniamo ogni volta la lista dei creatori
                    }
                } catch (e) { }
                inserzione.version = "Caller"
                try {
                    var nlm = nftListSniping.find(el => inserzione.buildCollezioneString === el.collezione)
                    inserzione.soglia = nlm.floorPrice * sogliaPerc
                } catch (e) { }
                console.log(inserzione)
                var parseInformationsEnd = performance.now()
                var findGoodNftStart = performance.now()
                var nelMirino = _.sortBy(nftListSniping.filter(x => x.collezione === inserzione.buildCollezioneString), ["floorPrice"])[0]
                // var nelMirino = _.sortBy(nftListSniping.filter(x => x.collezione === inserzione.buildCollezioneString && Number(inserzione.prezzo) <= (x.floorPrice * sogliaPerc)), ["floorPrice"])[0]
                // var nelMirino = nftListSniping.find(el => inserzione.buildCollezioneString === el.collezione && Number(inserzione.prezzo) <= (el.floorPrice * sogliaPerc))
                var isNotPezzente = true
                if (nelMirino && filtroPrezziPezzenti) {
                    isNotPezzente = Number(nelMirino.floorPrice) > sogliaFiltroPezzente
                    if (!isNotPezzente && nelMirino && nelMirino.volumeAll > sogliaVolume && (filtroVolumeH24 ? nelMirino.volume24hr > 0 : true) && Number(inserzione.prezzo) <= nelMirino.soglia) {
                        discordWebHooks.sendWarning(generalWebhook, `Ho trovato ${inserzione.nome} a ${inserzione.prezzo} (soglia: ${nelMirino.soglia}; floor price: ${nelMirino.floorPrice}, ma se flippa a pochi spicci perché il floor è sotto la soglia di ${sogliaFiltroPezzente}); SKIPPO`)
                    }
                }
                if (isNotPezzente && nelMirino && nelMirino.volumeAll > sogliaVolume && (filtroVolumeH24 ? nelMirino.volume24hr > 0 : true) && Number(inserzione.prezzo) <= nelMirino.soglia) {
                    discordWebHooks.sendMessage(generalWebhook, `Ho trovato un pezzo niente male su Magic Eden: ${inserzione.nome} a ${inserzione.prezzo} (soglia: ${nelMirino.soglia}; floor price: ${nelMirino.floorPrice})`)
                    var findGoodNftEnd = performance.now()
                    var sendSignStart = performance.now()
                    var scammy = antiRugPullArray.find(el => el.collezione === inserzione.buildCollezioneString)
                    if (scammy && scammy.nome != inserzione.nome) {
                        var i = antiRugPullArray.indexOf(scammy)
                        var newScammy = {
                            collezione: antiRugPullArray[i].collezione,
                            nome: inserzione.nome,
                            numero: antiRugPullArray[i].numero + 1,
                            timestamp: antiRugPullArray[i].nuovaApparizione,
                            nuovaApparizione: Date.now()
                        }
                        newScammy.differenza = newScammy.nuovaApparizione - newScammy.timestamp
                        antiRugPullArray.splice(i, 1)
                        antiRugPullArray = [...antiRugPullArray, newScammy]
                        discordWebHooks.sendMessage(generalWebhook, `Lista RUG: ${JSON.stringify(antiRugPullArray)}`)
                        if (newScammy.numero > sogliaRug) {
                            discordWebHooks.sendWarning(warningWebhook, `Possibile rug pull per ${inserzione.nome}!`)
                            return
                        }
                    } else {
                        var antirugObject = {
                            collezione: inserzione.buildCollezioneString,
                            nome: inserzione.nome,
                            numero: 1,
                            timestamp: Date.now(),
                            nuovaApparizione: Date.now(),
                        }
                        antiRugPullArray.push(antirugObject)
                    }
                    try {
                        var sign = await MEbuyOnChain(arrayPvtKey, inserzione)
                        // if (!sign) {
                        //     throw new Error(sign)
                        // }
                        if (sign) {
                            discordWebHooks.newBuyOnChainME(successMeWebhook, sign)
                        }
                    } catch (e) {
                        discordWebHooks.errorLogs(errorWebhook, e)
                    }
                    var sendSignEnd = performance.now()
                    try {
                        var w = {
                            type: "Call (ME)",
                            ArrivedAt: ArrivedAt,
                            getConfirmTrans: (getConfirmTransEnd - getConfirmTransStart) / 1000,
                            escrowPubkey: inserzione.escrowPubkey,
                            parseInformations: (parseInformationsEnd - parseInformationsStart) / 1000,
                            findGoodNft: (findGoodNftEnd - findGoodNftStart) / 1000,
                            sendSign: (sendSignEnd - sendSignStart) / 1000,
                            total: (getConfirmTransEnd - getConfirmTransStart) / 1000 + (parseInformationsEnd - parseInformationsStart) / 1000 + (findGoodNftEnd - findGoodNftStart) / 1000 + (sendSignEnd - sendSignStart) / 1000
                        }
                        discordWebHooks.timestampsTask(generalWebhook, w)
                    } catch (e) { }
                }
            }
            await coolDown(coolDownPeriodMonitorCall)
        } catch (e) {
            problemaMagicEdenCall = true
            console.log(e)
            try {
                discordWebHooks.errorLogsME(errorWebhook, e)
            } catch (e) { console.log(e) }
            setTimeout(() => {
                // monitorCall() //non lo reinvocare, altrimenti crea un loop infinito
            }, coolDownPeriodError)
        }
    }
}

setInterval(() => { //aggiorniamo ogni 60 secondi il file contente tutte le nuove collezioni sniperate nel corso dell'asconto
    try {
        fs.writeFileSync(path.join(__dirname, "collezioniMagicEden.json"), JSON.stringify(collezioniTrovate))
    } catch (e) { }
}, 60000)


//quando si inizieranno ad avere casini con l'endpoint, si lancerà il floor updater una volta sola (all'inizio) e poi si aggiorneranno i floor attraverso le inserzioni di vendita in arrivo
setInterval(async () => { //riguardiamo i floors 3 minuti (il processo ci mette mediamente dieci minuti e si accavallano le richieste)
    try {
        if (nftListSniping) {
            cachednftList = nftListSniping
        }
        var file = "nftSuME.json"
        var lista = await readFile(path.join(__dirname, file))
        if (lista) {
            nftListSniping =  JSON.parse(lista)
        }
    } catch (e) {
        nftListSniping = cachednftList
        discordWebHooks.errorLogs(errorWebhook, `C'è stato un problema nel leggere la lista dal file ${file}`)
    }
}, 50000) //180000

setInterval(() => { //ogni 5 secondi, controlliamo se la differenza tra il timestamp dell'ultimo prezzo bono e del penultimo prezzo bono è minore di 5 secondi. Scartiamo invece tutti quegli oggetti la cui distanza è maggiore
    antiRugPullArray = antiRugPullArray.map((x) => {
        if ((x.nuovaApparizione - x.timestamp) < delayRug && x.numero > 1 && Date.now() - x.nuovaApparizione < blackDelay) {
            return x
        }
    }).filter((x) => { if (x) return x })
}, blackDelay)

twirlTimer()

    ; (async () => {
        monitor()
    })()

///////////////////////////////Parte dedicata a Jarvis
var parole = ["la trasparenza di ogni atto decisionale",
    "la non sanitarizzazione delle risposte",
    "un indispensabile salto di qualità",
    "una congrua flessibilità delle strutture",
    "l'annullamento di ogni ghettizzazione",
    "il coinvolgimento attivo di operatori ed utenti",
    "l'appianamento delle discrepanze e delle disgrazie esistenti",
    "la ridefinizione di una nuova figura professionale",
    "l'adozione di una metodologia differenziata",
    "le demedicalizzazione del linguaggio",

]
const token = ""
const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
var i = Math.floor(Math.random() * (parole.length))

const domain = "jmccmlyu33.medianetwork.cloud"

async function cercaFilmoSerie(filmOserie) {
    return new Promise((resolve, reject) => {
        var tipo = filmOserie === "film" ? "movie" : "tv"
        let isFilm = tipo === "movie"
        var randBinary = Math.round(Math.random())
        var categorie = ["popular", "top_rated"]
        var options = {
            'method': 'GET',
            'url': `https://api.themoviedb.org/3/${tipo}/${categorie[randBinary]}?api_key=&language=it-IT&page=1&region=IT`,
            'headers': {
            },
            resolveWithFullResponse: true
        };
        return request(options, function (error, response) {
            if (error) reject(error);
            try {
                // console.log(response.body)
                let pagina = JSON.parse(response.body)
                let listaFilm = pagina.results
                let film = listaFilm[_.random(listaFilm.length) - 1]
                let embed = new MessageEmbed()
                    .setTitle(isFilm ? film.title : film.name + "")
                    .setColor('00EEFF')
                    .setImage("https://www.themoviedb.org/t/p/w600_and_h900_bestv2" + film.poster_path)
                    .setDescription("" + film.overview)
                    .addFields(
                        { name: 'Voto', value: `${film.vote_average}/10 (numero voti:${film.vote_count})`, inline: true },
                        { name: 'Data di uscita', value: `${isFilm ? film.release_date : film.first_air_date}`, inline: false },
                    )
                resolve(embed)
            } catch (e) {
                reject(e)
            }
        });
    })
}

async function cercaGatto() {
    return new Promise((resolve) => {
        var options = {
            'method': 'GET',
            'url': 'https://api.thecatapi.com/v1/images/search?limit=1&size=full&mime_types=gif',
            'headers': {
                'authority': 'api.thecatapi.com',
                'accept': 'application/json, text/plain, */*',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.63 Safari/537.36',
                'x-api-key': 'DEMO-API-KEY',
                'sec-gpc': '1',
                'origin': 'https://thecatapi.com',
                'sec-fetch-site': 'same-site',
                'sec-fetch-mode': 'cors',
                'sec-fetch-dest': 'empty',
                'referer': 'https://thecatapi.com/',
                'accept-language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
                'if-modified-since': 'Tue Sep 07 2021 02:03:06 GMT+0000 (Coordinated Universal Time)'
            }
        };
        request(options, function (error, response) {
            if (error) throw new Error(error);
            console.log(response.body);
            resolve(JSON.parse(response.body)[0].url)
        });

    })
}

async function utilizzoDataHub() {
    return new Promise((resolve, reject) => {
        var options = {
            'method': 'GET',
            'url': 'https://datahub.figment.io/services/solana',
            'headers': {
                'authority': 'datahub.figment.io',
                'cache-control': 'max-age=0',
                'upgrade-insecure-requests': '1',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.63 Safari/537.36',
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                'sec-gpc': '1',
                'sec-fetch-site': 'same-origin',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-user': '?1',
                'sec-fetch-dest': 'document',
                'referer': 'https://datahub.figment.io/',
                'accept-language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
"cookie":"",                'if-none-match': 'W/"ccdc2a189da252c08e03341041b5c62b"'
            }
        };
        try {
            request(options, function (error, response) {
                if (error) throw new Error(error);
                var $ = cheerio.load(response.body)
                var status = $("#table1 > tbody > tr > td:nth-child(2)").eq(0).text().trim()
                var statusPercent = $("#table1 > tbody > tr > td:nth-child(3)").eq(0).text().trim()
                var a = {
                    status: status,
                    statusPercent: statusPercent
                }
                resolve(a)
            });
        } catch (e) {
            reject(e)
        }
    })
}

function wojakPiattaformaSwitcher(bot, message) {
    const channel = bot.channels.cache.find(channel => channel.name === "general")
    var contenuto = message.content
    if (!message.author.bot && almenoUnoPresente(contenuto.toLocaleLowerCase(), ["solanart", "sola", "solan"])) {
        altraPiattaforma = true
        // bot.user.setUsername("Jarvis Wojak (Solanart)");
        return false
    } else if (!message.author.bot && almenoUnoPresente(contenuto.toLocaleLowerCase(), ["magicEden", "magic", "magic eden"])) {
        altraPiattaforma = false
        // bot.user.setUsername("Jarvis Wojak (Magic Eden)");
        channel.send("Ok capo, passo a MAGIC EDEN")
        return true
    }
    else {
        return false
    }
}

async function parlaConMe(changed, message) {
    try {
        if (changed) {
            return
        }
        const channel = bot.channels.cache.find(channel => channel.name === "general")
        var contenuto = message.content
        if (!message.author.bot && contenuto.toUpperCase().includes("COME STAI")) {
            await channel.send(`Mah, non c'è male, stavo osservando ${parole[i]} ma non mi va di fa conversazione, se hai bisogno di qualcosa me lo dici`)
        }
        else if (!message.author.bot && almenoUnoPresente(contenuto.toLocaleLowerCase(), ["piatt", "dove"])) {
            await channel.send(`Bro mi stai facendo lavorare con  ${altraPiattaforma ? "MAGICEDEN" : "SOLANART"}`)
        }
        else if (!message.author.bot && almenoUnoPresente(contenuto.toLocaleLowerCase(), ["dimmi", "dimme", "lista", "tabella"])) {
            try {
                var collezioniTrovate = nftListSniping
                let listone = ""
                collezioniTrovate = (_.sortBy(collezioniTrovate, ["volumeAll"])).reverse()
                for (let z = 0; z < collezioniTrovate.length; z++) {
                    let specifiche = `Nome: ${collezioniTrovate[z].symbol} (${collezioniTrovate[z].listedCount})→ Prezzo medio: ${collezioniTrovate[z].avgPrice24hr}; Min: ${collezioniTrovate[z].floorPrice}; SOGLIA: ${collezioniTrovate[z].soglia}:\n`
                    listone += specifiche
                }
                var it = 1000
                channel.send(`Ok bro, tieni: (aspettati ${(listone.length / it).toFixed(0)} messaggi)`)
                for (var i = 0; i < listone.length; i = i + it) {
                    console.log((listone.substr(Math.min(i, listone.length), Math.min(it, listone.length))).length)
                    channel.send(listone.substr(Math.min(i, listone.length), Math.min(it, listone.length)))
                }
                channel.send("FINITO")
            } catch (e) { discordWebHooks.errorLogs(errorWebhook, e) }
        }
        else if (!message.author.bot && almenoUnoPresente(contenuto.toLocaleLowerCase(), ["metti", "cambia"])) {
            if (!message.author.bot && almenoUnoPresente(contenuto.toLocaleLowerCase(), ["limite"])) {
                let fraseScomposta = contenuto.toLocaleLowerCase().split(" ")
                var limite = Number(fraseScomposta.find(element => Number(element) > -1))
                channel.send(`Ok, chiederò le ultime ${limite} transazioni ogni volta`)
                limiteTransazioniPrese = limite
            }
            if (!message.author.bot && almenoUnoPresente(contenuto.toLocaleLowerCase(), ["soglia"])) {
                let fraseScomposta = contenuto.toLocaleLowerCase().split(" ")
                var limite = Number(fraseScomposta.find(element => Number(element) > -1))
                channel.send(`Ok, snipererò le vendite che saranno il ${limite}% del floor price`)
                sogliaPerc = limite / 100
            }
            if (!message.author.bot && almenoUnoPresente(contenuto.toLocaleLowerCase(), ["black"])) {
                let fraseScomposta = contenuto.toLocaleLowerCase().split(" ")
                var limite = Number(fraseScomposta.find(element => Number(element) > -1))
                channel.send(`Ok, la blacklist durerà ${limite} secondi`)
                blackDelay = limite * 1000
            }
            else if (!message.author.bot && almenoUnoPresente(contenuto.toLocaleLowerCase(), ["cooldown", "pausa"])) {
                let fraseScomposta = contenuto.toLocaleLowerCase().split(" ")
                var limite = Number(fraseScomposta.find(element => Number(element) > -1))
                channel.send(`Va bene bro, passo da una pausa di ${coolDownPeriodMonitorCall / 1000} secondi ad una di ${limite} secondi`)
                // coolDownPeriod = limite * 1000
                coolDownPeriodMonitorCall = limite * 1000
            }
        }
        else if (!message.author.bot && almenoUnoPresente(contenuto.toLocaleLowerCase(), ["basta", "stop", "ferma"])) {
            attivo = false
            venditeCounter = 0
            venditeCounter2 = 0
            try {
                await connection.removeOnLogsListener(subscriptionID)
            } catch (e) { }
            channel.send("Ok, ho fermato il mostro, ma sai quante occasioni starai a perde proprio mo?")
        }
        else if (!message.author.bot && almenoUnoPresente(contenuto.toLocaleLowerCase(), ["via", "vai", "start", "inizio"])) {
            attivo = true
            startDate = new Date().toISOString().split("T")[0]
            startHour = new Date().toISOString().split("T")[1].split(".")[0]
            channel.send("Ok si riparte, LESGO BICCIAESS")
            monitor()
            monitorCall()
        }
        else if (!message.author.bot && almenoUnoPresente(contenuto.toLocaleLowerCase(), ["stato", "status", "info"])) {
            let mess =
                attivo && !problemaMagicEden && !problemaMagicEdenCall ? `Capo siamo attivi e in gran forma, ATTIVI: ${attivo}`
                    : attivo && problemaMagicEden && !problemaMagicEdenCall ? `C'è stato un problema con il web socket, attualmente siamo fermi ma dovevamo sta attivi, DANNAZIONE`
                        : attivo && !problemaMagicEden && problemaMagicEdenCall ? `C'è stato un problema con le chiamate periodiche, attualmente siamo fermi ma dovevamo sta attivi, DANNAZIONE`
                            : attivo && problemaMagicEden && problemaMagicEdenCall ? `C'è stato un problema con il web socket e con le chiamate periodiche, attualmente siamo fermi ma dovevamo sta attivi, DANNAZIONE`
                                : `Il mostro è spento, io direi di svegliarlo, ATTIVI: ${attivo}`
            channel.send(mess)
        }
        else if (!message.author.bot && almenoUnoPresente(contenuto.toLocaleLowerCase(), ["grazie", "ringrazio"])) {
            let mess = "Bro sono un bot, l'utilità marginale del mio tempo è praticamente nulla, non mi costa niente concederti altri minuti"
            channel.send(mess)
        }
        else if (!message.author.bot && almenoUnoPresente(contenuto.toLocaleLowerCase(), ["film", "serie", "tv"])) {
            try {
                if (almenoUnoPresente(contenuto.toLocaleLowerCase(), ["film"])) {
                    cercaFilmoSerie("film").then((film) => {
                        console.log(film)
                        // channel.send(film)
                        channel.send({
                            content: "Te consiglio solo li meglio film dillo ;)",
                            username: null,
                            avatarURL: null,
                            embeds: [film],
                        });
                    })
                } else {
                    cercaFilmoSerie("serie").then((serie) => {
                        console.log(serie)
                        // channel.send(film)
                        channel.send({
                            content: "Te consiglio solo le meglio serie dillo ;)",
                            username: null,
                            avatarURL: null,
                            embeds: [serie],
                        });
                    })
                }
            } catch (e) {
                channel.send("Bro scollate un attimo please")
            }
        }
        else if (!message.author.bot && almenoUnoPresente(contenuto.toLocaleLowerCase(), ["saldo", "bilancio", "conto", "wallet", "portafoglio"])) {
            let saldo = (await connection.getBalance(wally.publicKey)) * 0.000000001
            channel.send(`Capo sul wallet hai ${saldo} solana `)
        }
        else if (!message.author.bot && almenoUnoPresente(contenuto.toLocaleLowerCase(), ["conta", "tx", "numero", "transazioni"])) {
            channel.send(`Da quando m'hai svegliato (il ${startDate}, alle ${startHour}) ho contato almeno almeno ${venditeCounter2} (v2), ${venditeCounter} (v3), inserzioni di vendita;`)
        }
        else if (!message.author.bot && almenoUnoPresente(contenuto.toLocaleLowerCase(), ["ti voglio bene"])) {
            channel.send("<3")
        }
        else if (!message.author.bot && almenoUnoPresente(contenuto.toLocaleLowerCase(), ["micio", "miao", "gatto", "cat", "gatti"])) {
            var gatto = await cercaGatto()
            channel.send(gatto)
        }
        else if (!message.author.bot && almenoUnoPresente(contenuto.toLocaleLowerCase(), ["datahub", "richieste", "figment"])) {
            utilizzoDataHub()
                .then(async (richieste) => {
                    channel.send(`Figment mi ha detto che stiamo a ${richieste.status} richieste totali (${richieste.statusPercent})`)
                })
                .catch(async (e) => {
                    channel.send(`Figment ha litigato con me :( mi ha detto ${e}`)
                })
        }
        else if (!message.author.bot && almenoUnoPresente(contenuto.toLocaleLowerCase(), ["error"])) {
            let fraseScomposta = contenuto.toLocaleLowerCase().split(" ").filter((x) => { if (x != " " && x != "" && x) return x })
            var a = await doesExistPath(path.join(__dirname, "tx_errors"))
            if (!a) {
                await makeDir(path.join(__dirname, "tx_errors"))
            }
            var listErrori = fs.readdirSync(path.join(__dirname, "tx_errors"))
            if (fraseScomposta.length === 1) {
                var m = `Capo, ecco il gravestone di alcune transazioni:`
                for (var i = 0; i < listErrori.length; i++) {
                    m += `\n${listErrori[i]}`
                }
                channel.send(m)
            } else {
                let nomeN = fraseScomposta[1]
                for (var i = 0; i < listErrori.length; i++) {
                    if (almenoUnoPresente(listErrori[i].toLocaleLowerCase(), [nomeN.toLocaleLowerCase()])) {
                        //manda file listErrori[i]
                        message.channel.send({ files: [`./tx_errors/${listErrori[i]}`] })
                    }
                }
            }
        }
        else if (!message.author.bot && almenoUnoPresente(contenuto.toLocaleLowerCase(), ["usa"])) {
            let fraseScomposta = contenuto.toLocaleLowerCase().split(" ")
            var uso = Number(fraseScomposta.find(element => Number(element) > -1))
            if (Number(uso) === 1) {
                connection = connection1
                channel.send("Perfetto, ho messo la connessione bona")
            }
            if (Number(uso) === 2) {
                connection = connection2
                channel.send("Ok, ho messo la connessione poraccia")
            }
            if (Number(uso) === 3) {
                connection = connection3
                channel.send("Ok, ho messo la connessione buona di pokt")
            }
            if (Number(uso) === 4) {
                connection = connection1altra
                channel.send("Ok, ho messo la connessione buona di riserva")
            }
            if(!usaConnessioneGratuitaPerMetadati){
                if(connection === connection1){
                    connection2=connection1altra
                    channel.send("... e ho messo quella buona di riserva (webgu) per i metadati")

                }else{
                    connection2=connection1
                    channel.send("... e ho messo quella buona (fede) per i metadati")
                }
            }
        }
        else if (!message.author.bot && almenoUnoPresente(contenuto.toLocaleLowerCase(), ["rug"])) {
            var t = ""
            for (var i = 0; i < antiRugPullArray.length; i++) {
                if (antiRugPullArray[i].numero > sogliaRug) {
                    t += antiRugPullArray[i].collezione + ` (${antiRugPullArray[i].numero})` + "\n"
                }
            }
            await channel.send(t)
        }
        else {
            if (!message.author.bot) {
                channel.send("Scusame ma non t'ho capito, parla come n'cristiano te prego")
            }
        }
    } catch (e) {
        discordWebHooks.errorLogs(errorWebhook, e)
    }
}

try {
    bot.on('ready', async function () {
        bot.user.setActivity({ type: "WATCHING", name: parole[i] })
        const channel = bot.channels.cache.find(channel => channel.name === "general")
        await channel.send("Yawnn, stavo a dormi tacci tua, mo sto in piedi però, quando vuoi sto qui")
    })
} catch (e) {
    discordWebHooks.errorLogs(errorWebhook, e)
}
try {
    bot.on("message", (message) => {
        try {
            var changed = wojakPiattaformaSwitcher(bot, message)
            if (!altraPiattaforma) {
                parlaConMe(changed, message)
            }
        } catch (e) {
            discordWebHooks.errorLogs(errorWebhook, e)
        }
    })
} catch (e) {
    discordWebHooks.errorLogs(errorWebhook, e)
}
try {
    bot.login(token);
} catch (e) {
    discordWebHooks.errorLogs(errorWebhook, e)
}