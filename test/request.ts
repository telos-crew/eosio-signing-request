import * as assert from 'assert'
import 'mocha'
import {TextDecoder, TextEncoder} from 'util'

import abiProvider from './utils/mock-abi-provider'
import mockAbiProvider from './utils/mock-abi-provider'
import zlib from './utils/node-zlib-provider'

import {SignatureProvider, SigningRequestEncodingOptions} from '../src'
import * as TSModule from '../src'

let {SigningRequest, PlaceholderAuth, PlaceholderName} = TSModule
if (process.env['TEST_UMD']) {
    const UMDModule = require('./../lib/index.umd')
    SigningRequest = UMDModule.SigningRequest
    console.log(' -- TESTING UMD BUNDLE -- ')
}

const options: SigningRequestEncodingOptions = {
    abiProvider,
    zlib,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder(),
}

const timestamp = '2018-02-15T00:00:00.000'

describe('signing request', function() {
    it('should create from action', async function() {
        const request = await SigningRequest.create(
            {
                action: {
                    account: 'eosio.token',
                    name: 'transfer',
                    authorization: [{actor: 'foo', permission: 'active'}],
                    data: {from: 'foo', to: 'bar', quantity: '1.000 EOS', memo: 'hello there'},
                },
            },
            options
        )
        assert.deepStrictEqual(request.data, {
            chain_id: ['chain_alias', 1],
            req: [
                'action',
                {
                    account: 'eosio.token',
                    name: 'transfer',
                    authorization: [{actor: 'foo', permission: 'active'}],
                    data:
                        '000000000000285D000000000000AE39E80300000000000003454F53000000000B68656C6C6F207468657265',
                },
            ],
            callback: '',
            flags: 1,
            info: [],
        })
    })

    it('should create from actions', async function() {
        const request = await SigningRequest.create(
            {
                callback: {
                    url: 'https://example.com/?tx={{tx}}',
                    background: true,
                },
                actions: [
                    {
                        account: 'eosio.token',
                        name: 'transfer',
                        authorization: [{actor: 'foo', permission: 'active'}],
                        data: {from: 'foo', to: 'bar', quantity: '1.000 EOS', memo: 'hello there'},
                    },
                    {
                        account: 'eosio.token',
                        name: 'transfer',
                        authorization: [{actor: 'baz', permission: 'active'}],
                        data: {from: 'baz', to: 'bar', quantity: '1.000 EOS', memo: 'hello there'},
                    },
                ],
            },
            options
        )
        assert.deepStrictEqual(request.data, {
            chain_id: ['chain_alias', 1],
            req: [
                'action[]',
                [
                    {
                        account: 'eosio.token',
                        name: 'transfer',
                        authorization: [{actor: 'foo', permission: 'active'}],
                        data:
                            '000000000000285D000000000000AE39E80300000000000003454F53000000000B68656C6C6F207468657265',
                    },
                    {
                        account: 'eosio.token',
                        name: 'transfer',
                        authorization: [{actor: 'baz', permission: 'active'}],
                        data:
                            '000000000000BE39000000000000AE39E80300000000000003454F53000000000B68656C6C6F207468657265',
                    },
                ],
            ],
            callback: 'https://example.com/?tx={{tx}}',
            flags: 3,
            info: [],
        })
    })

    it('should create from transaction', async function() {
        const request = await SigningRequest.create(
            {
                broadcast: false,
                callback: 'https://example.com/?tx={{tx}}',
                transaction: {
                    delay_sec: 123,
                    expiration: timestamp,
                    max_cpu_usage_ms: 99,
                    actions: [
                        {
                            account: 'eosio.token',
                            name: 'transfer',
                            authorization: [{actor: 'foo', permission: 'active'}],
                            data:
                                '000000000000285D000000000000AE39E80300000000000003454F53000000000B68656C6C6F207468657265',
                        },
                    ],
                },
            },
            options
        )
        assert.deepStrictEqual(request.data, {
            chain_id: ['chain_alias', 1],
            req: [
                'transaction',
                {
                    actions: [
                        {
                            account: 'eosio.token',
                            name: 'transfer',
                            authorization: [{actor: 'foo', permission: 'active'}],
                            data:
                                '000000000000285D000000000000AE39E80300000000000003454F53000000000B68656C6C6F207468657265',
                        },
                    ],
                    context_free_actions: [],
                    delay_sec: 123,
                    expiration: timestamp,
                    max_cpu_usage_ms: 99,
                    max_net_usage_words: 0,
                    ref_block_num: 0,
                    ref_block_prefix: 0,
                    transaction_extensions: [],
                },
            ],
            callback: 'https://example.com/?tx={{tx}}',
            flags: 0,
            info: [],
        })
    })

    it('should create from uri', async function() {
        const request = await SigningRequest.from(
            'esr://gmNgZGBY1mTC_MoglIGBIVzX5uxZRqAQGMBoExgDAjRi4fwAVz93ICUckpGYl12skJZfpFCSkaqQllmcwczAAAA',
            options
        )
        assert.deepStrictEqual(request.data, {
            chain_id: ['chain_alias', 1],
            req: [
                'action',
                {
                    account: 'eosio.token',
                    name: 'transfer',
                    authorization: [{actor: PlaceholderName, permission: PlaceholderName}],
                    data:
                        '0100000000000000000000000000285D01000000000000000050454E47000000135468616E6B7320666F72207468652066697368',
                },
            ],
            callback: '',
            flags: 3,
            info: [],
        })
    })

    it('should resolve to transaction', async function() {
        const request = await SigningRequest.create(
            {
                action: {
                    account: 'eosio.token',
                    name: 'transfer',
                    authorization: [{actor: 'foo', permission: 'active'}],
                    data: {from: 'foo', to: 'bar', quantity: '1.000 EOS', memo: 'hello there'},
                },
            },
            options
        )
        const abis = await request.fetchAbis()
        const tx = await request.resolveTransaction(
            abis,
            {actor: 'foo', permission: 'bar'},
            {
                timestamp,
                block_num: 1234,
                expire_seconds: 0,
                ref_block_prefix: 56789,
            }
        )
        assert.deepStrictEqual(tx, {
            actions: [
                {
                    account: 'eosio.token',
                    name: 'transfer',
                    authorization: [{actor: 'foo', permission: 'active'}],
                    data: {from: 'foo', to: 'bar', quantity: '1.000 EOS', memo: 'hello there'},
                },
            ],
            context_free_actions: [],
            transaction_extensions: [],
            expiration: timestamp,
            ref_block_num: 1234,
            ref_block_prefix: 56789,
            max_cpu_usage_ms: 0,
            max_net_usage_words: 0,
            delay_sec: 0,
        })
    })

    it('should resolve with placeholder name', async function() {
        const request = await SigningRequest.create(
            {
                action: {
                    account: 'eosio.token',
                    name: 'transfer',
                    authorization: [PlaceholderAuth],
                    data: {
                        from: '............1',
                        to: '............2',
                        quantity: '1.000 EOS',
                        memo: 'hello there',
                    },
                },
            },
            options
        )
        const abis = await request.fetchAbis()
        const tx = await request.resolveTransaction(
            abis,
            {actor: 'foo', permission: 'mractive'},
            {
                timestamp,
                block_num: 1234,
                expire_seconds: 0,
                ref_block_prefix: 56789,
            }
        )
        assert.deepStrictEqual(tx, {
            actions: [
                {
                    account: 'eosio.token',
                    name: 'transfer',
                    authorization: [{actor: 'foo', permission: 'mractive'}],
                    data: {from: 'foo', to: 'mractive', quantity: '1.000 EOS', memo: 'hello there'},
                },
            ],
            context_free_actions: [],
            transaction_extensions: [],
            expiration: timestamp,
            ref_block_num: 1234,
            ref_block_prefix: 56789,
            max_cpu_usage_ms: 0,
            max_net_usage_words: 0,
            delay_sec: 0,
        })
    })

    it('should encode and decode requests', async function() {
        const req1 = await SigningRequest.create(
            {
                callback: {
                    url: '',
                    background: true,
                },
                action: {
                    account: 'eosio.token',
                    name: 'transfer',
                    authorization: [{actor: PlaceholderName, permission: PlaceholderName}],
                    data: {
                        from: PlaceholderName,
                        to: 'foo',
                        quantity: '1. PENG',
                        memo: 'Thanks for the fish',
                    },
                },
            },
            options
        )
        const encoded = req1.encode()
        assert.strictEqual(
            encoded,
            'esr://gmNgZGBY1mTC_MoglIGBIVzX5uxZRqAQGMBoExgDAjRi4fwAVz93ICUckpGYl12skJZfpFCSkaqQllmcwczAAAA'
        )
        const req2 = SigningRequest.from(encoded, options)
        assert.deepStrictEqual(req2.data, req1.data)
    })

    it('should create identity tx', async function() {
        let req = await SigningRequest.identity(
            {
                callback: {
                    background: true,
                    url: 'https://example.com',
                },
            },
            options
        )
        let tx = req.resolveTransaction(mockAbiProvider.abis, {
            actor: 'foo',
            permission: 'bar',
        })
        assert.deepStrictEqual(tx, {
            actions: [
                {
                    account: '',
                    name: 'identity',
                    authorization: [
                        {
                            actor: 'foo',
                            permission: 'bar',
                        },
                    ],
                    data: {
                        permission: {
                            actor: 'foo',
                            permission: 'bar',
                        },
                    },
                },
            ],
            context_free_actions: [],
            transaction_extensions: [],
            expiration: '1970-01-01T00:00:00.000',
            ref_block_num: 0,
            ref_block_prefix: 0,
            max_cpu_usage_ms: 0,
            max_net_usage_words: 0,
            delay_sec: 0,
        })
        let tx2 = req.resolveTransaction(mockAbiProvider.abis, {
            actor: 'other',
            permission: 'active',
        })
        assert.notStrictEqual(tx2.actions[0].data, tx.actions[0].data)
    })

    it('should encode and decode signed requests', async function() {
        const mockSig = {
            signer: 'foo',
            signature:
                'SIG_K1_K8Wm5AXSQdKYVyYFPCYbMZurcJQXZaSgXoqXAKE6uxR6Jot7otVzS55JGRhixCwNGxaGezrVckDgh88xTsiu4wzzZuP9JE',
        }
        const signatureProvider: SignatureProvider = {
            sign(message) {
                return mockSig
            },
        }
        const req1 = await SigningRequest.create(
            {
                action: {
                    account: 'eosio.token',
                    name: 'transfer',
                    authorization: [{actor: 'foo', permission: 'active'}],
                    data: {from: 'foo', to: 'bar', quantity: '1.000 EOS', memo: 'hello there'},
                },
            },
            {...options, signatureProvider}
        )
        assert.deepStrictEqual(req1.signature, mockSig)
        let encoded = req1.encode()
        assert.strictEqual(
            encoded,
            'esr://gmNgZGBY1mTC_MoglIGBIVzX5uxZoAgIaMSCyBVvjYx0kAUYGNZZvmCGsJhd_YNBNHdGak5OvkJJRmpRKlQ3WLl8anjWFNWd23XWfvzTcy_qmtRx5mtMXlkSC23ZXle6K_NJFJ4SVTb4O026Wb1G5Wx0u1A3-_G4rAPsBp78z9lN7nddAQA'
        )
        let req2 = SigningRequest.from(encoded, options)
        assert.deepStrictEqual(req2.data, req1.data)
        assert.deepStrictEqual(req2.signature, mockSig)
    })

    it('should encode and decode test requests', async function() {
        let req1uri =
            'esr://gmNgZGBY1mTC_MoglIGBIVzX5uxZRqAQGMBoExgDAjRi4fwAVz93ICUckpGYl12skJZfpFCSkaqQllmcwczAAAA'
        let req2uri =
            'esr://gmNgZGBY1mTC_MoglIGBIVzX5uxZRqAQGMBoExgDAjRi4fwAVz93ICUckpGYl12skJZfpFCSkaqQllmcwQxREVOsEcsgX-9-jqsy1EhNQM_GM_FkQMIziUU1VU4PsmOn_3r5hUMumeN3PXvdSuWMm1o9u6-FmCwtPvR0haqt12fNKtlWzTuiNwA'
        let req1 = SigningRequest.from(req1uri, options)
        let req2 = SigningRequest.from(req2uri, options)
        assert.deepStrictEqual(
            req1.resolveActions(mockAbiProvider.abis),
            req2.resolveActions(mockAbiProvider.abis)
        )
        assert.strictEqual(req1.signature, undefined)
        assert.deepStrictEqual(req2.signature, {
            signer: 'foobar',
            signature:
                'SIG_K1_KBub1qmdiPpWA2XKKEZEG3EfKJBf38GETHzbd4t3CBdWLgdvFRLCqbcUsBbbYga6jmxfdSFfodMdhMYraKLhEzjSCsiuMs',
        })
        assert.strictEqual(req1.encode(), req1uri)
        assert.strictEqual(req2.encode(), req2uri)
    })

    it('should generate correct identity requests', async function() {
        let reqUri = 'esr://AgABAwACJWh0dHBzOi8vY2guYW5jaG9yLmxpbmsvMTIzNC00NTY3LTg5MDAA'
        let req = SigningRequest.from(reqUri, options)
        assert.strictEqual(req.isIdentity(), true)
        assert.strictEqual(req.getIdentity(), null)
        assert.strictEqual(req.getIdentityPermission(), null)
        assert.strictEqual(req.encode(), reqUri)
        let resolved = req.resolve(new Map(), {actor: 'foo', permission: 'bar'})
        assert.deepStrictEqual(resolved.transaction, {
            actions: [
                {
                    account: '',
                    name: 'identity',
                    authorization: [
                        {
                            actor: 'foo',
                            permission: 'bar',
                        },
                    ],
                    data: {
                        permission: {
                            actor: 'foo',
                            permission: 'bar',
                        },
                    },
                },
            ],
            context_free_actions: [],
            delay_sec: 0,
            expiration: '1970-01-01T00:00:00.000',
            max_cpu_usage_ms: 0,
            max_net_usage_words: 0,
            ref_block_num: 0,
            ref_block_prefix: 0,
            transaction_extensions: [],
        })
    })

    it('should encode and decode with metadata', async function() {
        let req = await SigningRequest.identity(
            {
                callback: 'https://example.com',
                info: {
                    foo: 'bar',
                    baz: new Uint8Array([0x00, 0x01, 0x02]) as any,
                },
            },
            options
        )
        let decoded = SigningRequest.from(req.encode(), options)
        assert.deepStrictEqual(decoded.getInfo(), req.getInfo())
        assert.deepStrictEqual(decoded.getInfo(), {foo: 'bar', baz: '\u0000\u0001\u0002'})
    })

    it('should template callback url', async function() {
        const mockSig = 'SIG_K1_K8Wm5AXSQdKYVyYFPCYbMZurcJQXZaSgXoqXAKE6uxR6Jot7otVzS55JGRhixCwNGxaGezrVckDgh88xTsiu4wzzZuP9JE'
        const mockTx = '308D206C51C5DD6C02E0417E44560CDC2E76DB7765CEA19DFA8F9F94922F928A'
        const request = await SigningRequest.create(
            {
                action: {
                    account: 'eosio.token',
                    name: 'transfer',
                    authorization: [{actor: 'foo', permission: 'active'}],
                    data: {from: 'foo', to: 'bar', quantity: '1.000 EOS', memo: 'hello there'},
                },
                callback: 'https://example.com/?sig={{sig}}&tx={{tx}}'
            },
            options
        )
        const abis = await request.fetchAbis()
        const resolved = await request.resolve(
            abis,
            {actor: 'foo', permission: 'bar'},
            {
                timestamp,
                block_num: 1234,
                expire_seconds: 0,
                ref_block_prefix: 56789,
            }
        )
        const callback:any = resolved.getCallback([mockSig]);
        const expected = `https://example.com/?sig=${mockSig}&tx=${mockTx}`
        assert.deepStrictEqual(callback.url, expected)
    })

    it('should deep clone', async function() {
        const request = await SigningRequest.create(
            {
                action: {
                    account: 'eosio.token',
                    name: 'transfer',
                    authorization: [{actor: 'foo', permission: 'active'}],
                    data: {from: 'foo', to: 'bar', quantity: '1.000 EOS', memo: ''},
                },
            },
            options
        )
        const copy = request.clone()

        assert.deepStrictEqual(request.data, copy.data)
        assert.deepStrictEqual(request.encode(), copy.encode())

        copy.setInfoKey('foo', true)
        assert.notDeepStrictEqual(request.data, copy.data)
        assert.notDeepStrictEqual(request.encode(), copy.encode())
    })

    it('should resolve templated callback urls', async function () {
        const req1uri =
            'esr://gmNgZGBY1mTC_MoglIGBIVzX5uxZRqAQGDBBaUWYAARoxMIkGAJDIyAM9YySkoJiK3391IrE3IKcVL3k_Fz7kgrb6uqSitpataQ8ICspr7aWAQA'
        const req1 = SigningRequest.from(req1uri, options)
        const abis = await req1.fetchAbis()
        const resolved = await req1.resolve(
            abis,
            { actor: 'foo', permission: 'bar' },
            {
                timestamp,
                block_num: 1234,
                expire_seconds: 0,
                ref_block_prefix: 56789,
            }
        )
        const callback = resolved.getCallback(['SIG_K1_KBub1qmdiPpWA2XKKEZEG3EfKJBf38GETHzbd4t3CBdWLgdvFRLCqbcUsBbbYga6jmxfdSFfodMdhMYraKLhEzjSCsiuMs'], 1234)
        const expected = 'https://example.com?tx=6AFF5C203810FF6B40469FE20318856354889FF037F4CF5B89A157514A43E825&bn=1234'
        assert.equal(callback!.url, expected)
    })
})
