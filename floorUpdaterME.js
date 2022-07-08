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
const arrayPvtKeyME = []
 const wally = Keypair.fromSecretKey(new Uint8Array(arrayPvtKey))
const wallyMe = Keypair.fromSecretKey(new Uint8Array(arrayPvtKeyME))

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
const { exec } = require('child_process');
var cachednftList = nftListSniping
var coolDownPeriodRequest = 0 //occhio al rateLimiting
var sogliaPerc = 0.7
const url = ""

var coolDownPeriod = 250 //non viene usata nel websocket ma solo nel floor updater
var coolDownPeriodMonitorCall = 300
var altraPiattaforma = true
var venditeCounter = 0
var venditeCounter2 = 0
var startDate = new Date().toISOString().split("T")[0]
var startHour = new Date().toISOString().split("T")[1].split(".")[0]
var wsConnection1 = ""
var connection1 = new Connection(url, { httpHeaders: { Authorization: '' }, wsEndpoint: "", commitment: "confirmed" })
var connection1altra = new Connection(url, { httpHeaders: { Authorization: '' }, wsEndpoint: "", commitment: "confirmed" })
var connection3 = new Connection("")
var connection2 = new Connection("")
var connection = connection1altra

var usaConnessioneBuonaPerMandareTransazioneAcquisto = false
var usaConnessioneGratuitaPerMetadati = true

var filtroPrezziPezzenti = false
var sogliaFiltroPezzente = 0.1

var blacklist = ["GTKT_&_Ef896VQS1tfMACgL5Ce1TR7JZhehkrtowCyZZyYv7SWn", "NTG_&_FnfPWx7nXj76REBNi5zLWUbuadrCrTDx5u9fytetgdjn", "_&_HHTcbLmSQoSFHFfhPH14KGBWTpQ8cvCgaLE5YrqPnSBx"]

var antiRugPullArray = []
var sogliaRug = 1
var delayRug = 60000
var blackDelay = 150000

async function getMetadataAccount(nftAddress) {
    var address = (await PublicKey.findProgramAddress([Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), nftAddress.toBuffer()], TOKEN_METADATA_PROGRAM_ID))[0]
    return address
}

function coolDown(coolDownPeriod) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve()
        }, coolDownPeriod)
    })
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
                    var nomiCollezione = JSON.parse(response.body).collections.map((x) => { 
                        if(!x.isFlagged){
                            return x.symbol
                        } 
                    }).filter((x) => { if (x) return x })
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
                        try{
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
                        }catch(e){}
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
const token = ""
const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

massivePriceCheckEndpoint(true)
setInterval(async () => { //riguardiamo i floors 3 minuti (il processo ci mette mediamente dieci minuti e si accavallano le richieste)
    try {
        try{
            exec('git commit -a -m "autocommit"');
            exec('git push');
            discordWebHooks.sendMessage(ignoreWebhook,"pushato le modifiche della lista")
        }catch(e){
            discordWebHooks.sendWarning(warningWebhook,"Non sono riuscito a pushare le modifiche della lista")
        }
        if (nftListSniping) {
            cachednftList = nftListSniping
        }
        var lista = await massivePriceCheckEndpoint(true)
        if (lista) {
            nftListSniping = lista
        }
    } catch (e) {
        discordWebHooks.errorLogs(errorWebhook, "C'è stato un problema nell'aggiornamento dei floors, probabilmente a causa della connessione poraccia che ti ritrovi")
    }
}, 50000) //180000

setInterval(async()=>{
    try {
        let saldo = ((await connection2.getBalance(wally.publicKey)) * 0.000000001).toFixed(2)
        let saldoME = ((await connection2.getBalance(wallyMe.publicKey)) * 0.000000001).toFixed(2)
        bot.user.setActivity({ type: "WATCHING", name: `${saldo}+${saldoME}=${Number(saldo) + Number(saldoME)} SOL` })
        // bot.login(token);
    } catch (e) {
        discordWebHooks.errorLogs(errorWebhook, e)
    }
},10000)

try {
    bot.login(token);
} catch (e) {
    discordWebHooks.errorLogs(errorWebhook, e)
}