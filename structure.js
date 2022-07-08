"use strict";
exports.__esModule = true;
exports.decodeMetadata = exports.METADATA_SCHEMA = exports.Metadata = exports.Data = exports.Creator = exports.Edition = exports.EditionMarker = exports.MasterEditionV2 = exports.MasterEditionV1 = exports.MetadataCategory = exports.MetadataKey = exports.EDITION_MARKER_BIT_SIZE = exports.MAX_EDITION_LEN = exports.MAX_METADATA_LEN = exports.MAX_CREATOR_LEN = exports.MAX_CREATOR_LIMIT = exports.MAX_URI_LENGTH = exports.MAX_SYMBOL_LENGTH = exports.MAX_NAME_LENGTH = exports.RESERVATION = exports.EDITION = exports.METADATA_PREFIX = exports.extendBorsh = void 0;
var _a = require('@solana/web3.js'), SystemProgram = _a.SystemProgram, SYSVAR_RENT_PUBKEY = _a.SYSVAR_RENT_PUBKEY, TransactionInstruction = _a.TransactionInstruction;
var borsh_1 = require("borsh");
var web3_js_1 = require("@solana/web3.js");
var base58 = require('bs58');
var extendBorsh = function () {
    borsh_1.BinaryReader.prototype.readPubkey = function () {
        var reader = this;
        var array = reader.readFixedArray(32);
        return new web3_js_1.PublicKey(array);
    };
    borsh_1.BinaryWriter.prototype.writePubkey = function (value) {
        var writer = this;
        writer.writeFixedArray(value.toBuffer());
    };
    borsh_1.BinaryReader.prototype.readPubkeyAsString = function () {
        var reader = this;
        var array = reader.readFixedArray(32);
        return base58.encode(array);
    };
    borsh_1.BinaryWriter.prototype.writePubkeyAsString = function (value) {
        var writer = this;
        writer.writeFixedArray(base58.decode(value));
    };
};
exports.extendBorsh = extendBorsh;
(0, exports.extendBorsh)();
exports.METADATA_PREFIX = 'metadata';
exports.EDITION = 'edition';
exports.RESERVATION = 'reservation';
exports.MAX_NAME_LENGTH = 32;
exports.MAX_SYMBOL_LENGTH = 10;
exports.MAX_URI_LENGTH = 200;
exports.MAX_CREATOR_LIMIT = 5;
exports.MAX_CREATOR_LEN = 32 + 1 + 1;
exports.MAX_METADATA_LEN = 1 +
    32 +
    32 +
    exports.MAX_NAME_LENGTH +
    exports.MAX_SYMBOL_LENGTH +
    exports.MAX_URI_LENGTH +
    exports.MAX_CREATOR_LIMIT * exports.MAX_CREATOR_LEN +
    2 +
    1 +
    1 +
    198;
exports.MAX_EDITION_LEN = 1 + 32 + 8 + 200;
exports.EDITION_MARKER_BIT_SIZE = 248;
var MetadataKey;
(function (MetadataKey) {
    MetadataKey[MetadataKey["Uninitialized"] = 0] = "Uninitialized";
    MetadataKey[MetadataKey["MetadataV1"] = 4] = "MetadataV1";
    MetadataKey[MetadataKey["EditionV1"] = 1] = "EditionV1";
    MetadataKey[MetadataKey["MasterEditionV1"] = 2] = "MasterEditionV1";
    MetadataKey[MetadataKey["MasterEditionV2"] = 6] = "MasterEditionV2";
    MetadataKey[MetadataKey["EditionMarker"] = 7] = "EditionMarker";
})(MetadataKey = exports.MetadataKey || (exports.MetadataKey = {}));
var MetadataCategory;
(function (MetadataCategory) {
    MetadataCategory["Audio"] = "audio";
    MetadataCategory["Video"] = "video";
    MetadataCategory["Image"] = "image";
    MetadataCategory["VR"] = "vr";
})(MetadataCategory = exports.MetadataCategory || (exports.MetadataCategory = {}));
var MasterEditionV1 = /** @class */ (function () {
    function MasterEditionV1(args) {
        this.key = MetadataKey.MasterEditionV1;
        this.supply = args.supply;
        this.maxSupply = args.maxSupply;
        this.printingMint = args.printingMint;
        this.oneTimePrintingAuthorizationMint =
            args.oneTimePrintingAuthorizationMint;
    }
    return MasterEditionV1;
}());
exports.MasterEditionV1 = MasterEditionV1;
var MasterEditionV2 = /** @class */ (function () {
    function MasterEditionV2(args) {
        this.key = MetadataKey.MasterEditionV2;
        this.supply = args.supply;
        this.maxSupply = args.maxSupply;
    }
    return MasterEditionV2;
}());
exports.MasterEditionV2 = MasterEditionV2;
var EditionMarker = /** @class */ (function () {
    function EditionMarker(args) {
        this.key = MetadataKey.EditionMarker;
        this.ledger = args.ledger;
    }
    EditionMarker.prototype.editionTaken = function (edition) {
        var editionOffset = edition % exports.EDITION_MARKER_BIT_SIZE;
        var indexOffset = Math.floor(editionOffset / 8);
        if (indexOffset > 30) {
            throw Error('bad index for edition');
        }
        var positionInBitsetFromRight = 7 - (editionOffset % 8);
        var mask = Math.pow(2, positionInBitsetFromRight);
        var appliedMask = this.ledger[indexOffset] & mask;
        return appliedMask != 0;
    };
    return EditionMarker;
}());
exports.EditionMarker = EditionMarker;
var Edition = /** @class */ (function () {
    function Edition(args) {
        this.key = MetadataKey.EditionV1;
        this.parent = args.parent;
        this.edition = args.edition;
    }
    return Edition;
}());
exports.Edition = Edition;
var Creator = /** @class */ (function () {
    function Creator(args) {
        this.address = args.address;
        this.verified = args.verified;
        this.share = args.share;
    }
    return Creator;
}());
exports.Creator = Creator;
var Data = /** @class */ (function () {
    function Data(args) {
        this.name = args.name;
        this.symbol = args.symbol;
        this.uri = args.uri;
        this.sellerFeeBasisPoints = args.sellerFeeBasisPoints;
        this.creators = args.creators;
    }
    return Data;
}());
exports.Data = Data;
var Metadata = /** @class */ (function () {
    function Metadata(args) {
        this.key = MetadataKey.MetadataV1;
        this.updateAuthority = args.updateAuthority;
        this.mint = args.mint;
        this.data = args.data;
        this.primarySaleHappened = args.primarySaleHappened;
        this.isMutable = args.isMutable;
        this.editionNonce = args.editionNonce;
    }
    return Metadata;
}());
exports.Metadata = Metadata;
var CreateMetadataArgs = /** @class */ (function () {
    function CreateMetadataArgs(args) {
        this.instruction = 0;
        this.data = args.data;
        this.isMutable = args.isMutable;
    }
    return CreateMetadataArgs;
}());
var UpdateMetadataArgs = /** @class */ (function () {
    function UpdateMetadataArgs(args) {
        this.instruction = 1;
        this.data = args.data ? args.data : null;
        this.updateAuthority = args.updateAuthority ? args.updateAuthority : null;
        this.primarySaleHappened = args.primarySaleHappened;
    }
    return UpdateMetadataArgs;
}());
var CreateMasterEditionArgs = /** @class */ (function () {
    function CreateMasterEditionArgs(args) {
        this.instruction = 10;
        this.maxSupply = args.maxSupply;
    }
    return CreateMasterEditionArgs;
}());
var MintPrintingTokensArgs = /** @class */ (function () {
    function MintPrintingTokensArgs(args) {
        this.instruction = 9;
        this.supply = args.supply;
    }
    return MintPrintingTokensArgs;
}());
exports.METADATA_SCHEMA = new Map([
    [
        CreateMetadataArgs,
        {
            kind: 'struct',
            fields: [
                ['instruction', 'u8'],
                ['data', Data],
                ['isMutable', 'u8'], // bool
            ]
        },
    ],
    [
        UpdateMetadataArgs,
        {
            kind: 'struct',
            fields: [
                ['instruction', 'u8'],
                ['data', { kind: 'option', type: Data }],
                ['updateAuthority', { kind: 'option', type: 'pubkeyAsString' }],
                ['primarySaleHappened', { kind: 'option', type: 'u8' }],
            ]
        },
    ],
    [
        CreateMasterEditionArgs,
        {
            kind: 'struct',
            fields: [
                ['instruction', 'u8'],
                ['maxSupply', { kind: 'option', type: 'u64' }],
            ]
        },
    ],
    [
        MintPrintingTokensArgs,
        {
            kind: 'struct',
            fields: [
                ['instruction', 'u8'],
                ['supply', 'u64'],
            ]
        },
    ],
    [
        MasterEditionV1,
        {
            kind: 'struct',
            fields: [
                ['key', 'u8'],
                ['supply', 'u64'],
                ['maxSupply', { kind: 'option', type: 'u64' }],
                ['printingMint', 'pubkeyAsString'],
                ['oneTimePrintingAuthorizationMint', 'pubkeyAsString'],
            ]
        },
    ],
    [
        MasterEditionV2,
        {
            kind: 'struct',
            fields: [
                ['key', 'u8'],
                ['supply', 'u64'],
                ['maxSupply', { kind: 'option', type: 'u64' }],
            ]
        },
    ],
    [
        Edition,
        {
            kind: 'struct',
            fields: [
                ['key', 'u8'],
                ['parent', 'pubkeyAsString'],
                ['edition', 'u64'],
            ]
        },
    ],
    [
        Data,
        {
            kind: 'struct',
            fields: [
                ['name', 'string'],
                ['symbol', 'string'],
                ['uri', 'string'],
                ['sellerFeeBasisPoints', 'u16'],
                ['creators', { kind: 'option', type: [Creator] }],
            ]
        },
    ],
    [
        Creator,
        {
            kind: 'struct',
            fields: [
                ['address', 'pubkeyAsString'],
                ['verified', 'u8'],
                ['share', 'u8'],
            ]
        },
    ],
    [
        Metadata,
        {
            kind: 'struct',
            fields: [
                ['key', 'u8'],
                ['updateAuthority', 'pubkeyAsString'],
                ['mint', 'pubkeyAsString'],
                ['data', Data],
                ['primarySaleHappened', 'u8'],
                ['isMutable', 'u8'], // bool
            ]
        },
    ],
    [
        EditionMarker,
        {
            kind: 'struct',
            fields: [
                ['key', 'u8'],
                ['ledger', [31]],
            ]
        },
    ],
]);
// eslint-disable-next-line no-control-regex
var METADATA_REPLACE = new RegExp('\u0000', 'g');
var decodeMetadata = function (buffer) {
    var metadata = (0, borsh_1.deserializeUnchecked)(exports.METADATA_SCHEMA, Metadata, buffer);
    metadata.data.name = metadata.data.name.replace(METADATA_REPLACE, '');
    metadata.data.uri = metadata.data.uri.replace(METADATA_REPLACE, '');
    metadata.data.symbol = metadata.data.symbol.replace(METADATA_REPLACE, '');
    return metadata;
};
exports.decodeMetadata = decodeMetadata; 