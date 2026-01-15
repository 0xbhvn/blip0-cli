import {
	Contract,
	rpc,
	xdr,
} from "@stellar/stellar-sdk";
import { Spec } from "@stellar/stellar-sdk/contract";
import { NETWORK_PRESETS } from "./config-manager.js";

/**
 * Represents a contract function from the spec
 */
export interface ContractFunction {
	name: string;
	signature: string;
	inputs: { name: string; type: string }[];
	outputs: { type: string }[];
	doc?: string;
}

/**
 * Represents a contract event from the spec
 */
export interface ContractEvent {
	name: string;
	signature: string;
	fields: { name: string; type: string }[];
	doc?: string;
}

/**
 * The parsed contract specification
 */
export interface ContractSpec {
	functions: ContractFunction[];
	events: ContractEvent[];
}

/**
 * Result of fetching contract spec
 */
export type FetchContractSpecResult =
	| { success: true; spec: ContractSpec }
	| { success: false; error: string };

/**
 * Map Soroban type to readable string
 */
function typeToString(type: xdr.ScSpecTypeDef): string {
	const typeValue = type.switch().value;

	switch (typeValue) {
		case xdr.ScSpecType.scSpecTypeVal().value:
			return "Val";
		case xdr.ScSpecType.scSpecTypeBool().value:
			return "bool";
		case xdr.ScSpecType.scSpecTypeVoid().value:
			return "void";
		case xdr.ScSpecType.scSpecTypeError().value:
			return "Error";
		case xdr.ScSpecType.scSpecTypeU32().value:
			return "u32";
		case xdr.ScSpecType.scSpecTypeI32().value:
			return "i32";
		case xdr.ScSpecType.scSpecTypeU64().value:
			return "u64";
		case xdr.ScSpecType.scSpecTypeI64().value:
			return "i64";
		case xdr.ScSpecType.scSpecTypeTimepoint().value:
			return "Timepoint";
		case xdr.ScSpecType.scSpecTypeDuration().value:
			return "Duration";
		case xdr.ScSpecType.scSpecTypeU128().value:
			return "u128";
		case xdr.ScSpecType.scSpecTypeI128().value:
			return "i128";
		case xdr.ScSpecType.scSpecTypeU256().value:
			return "u256";
		case xdr.ScSpecType.scSpecTypeI256().value:
			return "i256";
		case xdr.ScSpecType.scSpecTypeBytes().value:
			return "Bytes";
		case xdr.ScSpecType.scSpecTypeString().value:
			return "String";
		case xdr.ScSpecType.scSpecTypeSymbol().value:
			return "Symbol";
		case xdr.ScSpecType.scSpecTypeAddress().value:
			return "Address";
		case xdr.ScSpecType.scSpecTypeOption().value: {
			const inner = type.option().valueType();
			return `Option<${typeToString(inner)}>`;
		}
		case xdr.ScSpecType.scSpecTypeResult().value: {
			const okType = type.result().okType();
			const errType = type.result().errorType();
			return `Result<${typeToString(okType)},${typeToString(errType)}>`;
		}
		case xdr.ScSpecType.scSpecTypeVec().value: {
			const elemType = type.vec().elementType();
			return `Vec<${typeToString(elemType)}>`;
		}
		case xdr.ScSpecType.scSpecTypeMap().value: {
			const keyType = type.map().keyType();
			const valType = type.map().valueType();
			return `Map<${typeToString(keyType)},${typeToString(valType)}>`;
		}
		case xdr.ScSpecType.scSpecTypeTuple().value: {
			const types = type.tuple().valueTypes();
			return `(${types.map(typeToString).join(",")})`;
		}
		case xdr.ScSpecType.scSpecTypeBytesN().value: {
			const n = type.bytesN().n();
			return `BytesN<${n}>`;
		}
		case xdr.ScSpecType.scSpecTypeUdt().value: {
			return type.udt().name().toString();
		}
		default:
			return "Unknown";
	}
}

/**
 * Build function signature from name and inputs
 */
function buildFunctionSignature(
	name: string,
	inputs: { name: string; type: string }[],
): string {
	const params = inputs.map((i) => i.type).join(",");
	return `${name}(${params})`;
}

/**
 * Build event signature from name and fields
 */
function buildEventSignature(
	name: string,
	fields: { name: string; type: string }[],
): string {
	const params = fields.map((f) => f.type).join(",");
	return `${name}(${params})`;
}

/**
 * Parse the spec entries into functions and events
 */
function parseSpecEntries(specEntries: xdr.ScSpecEntry[]): ContractSpec {
	const functions: ContractFunction[] = [];
	const events: ContractEvent[] = [];

	for (const entry of specEntries) {
		const entryType = entry.switch().value;

		if (entryType === xdr.ScSpecEntryKind.scSpecEntryFunctionV0().value) {
			const fn = entry.functionV0();
			const name = fn.name().toString();
			const doc = fn.doc().toString() || undefined;

			const inputs = fn.inputs().map((input) => ({
				name: input.name().toString(),
				type: typeToString(input.type()),
			}));

			const outputs = fn.outputs().map((output) => ({
				type: typeToString(output),
			}));

			// Skip internal functions (starting with __)
			if (!name.startsWith("__")) {
				functions.push({
					name,
					signature: buildFunctionSignature(name, inputs),
					inputs,
					outputs,
					doc,
				});
			}
		}

		// Events are defined as UDT structs with specific naming patterns
		// or as ScSpecEntryUdtEnumV0/ScSpecEntryUdtStructV0 with event semantics
		// For now, we'll look for structs that could be events
		if (entryType === xdr.ScSpecEntryKind.scSpecEntryUdtStructV0().value) {
			const struct = entry.udtStructV0();
			const name = struct.name().toString();
			const doc = struct.doc().toString() || undefined;

			// Check if this looks like an event (common patterns)
			const lowerName = name.toLowerCase();
			if (
				lowerName.includes("event") ||
				lowerName === "transfer" ||
				lowerName === "mint" ||
				lowerName === "burn" ||
				lowerName === "approval"
			) {
				const fields = struct.fields().map((field) => ({
					name: field.name().toString(),
					type: typeToString(field.type()),
				}));

				events.push({
					name,
					signature: buildEventSignature(name, fields),
					fields,
					doc,
				});
			}
		}
	}

	return { functions, events };
}

/**
 * Result of fetching contract executable info
 */
type ContractExecutableInfo =
	| { type: "wasm"; wasm: Buffer }
	| { type: "stellar_asset" };

/**
 * Fetch the contract executable info from the network
 * Handles both WASM contracts and Stellar Asset Contracts (SACs)
 */
async function fetchContractExecutable(
	contractId: string,
	rpcUrl: string,
): Promise<ContractExecutableInfo> {
	const server = new rpc.Server(rpcUrl);

	// Step 1: Get the contract instance to find the executable type
	const contract = new Contract(contractId);
	const instanceKey = contract.getFootprint();

	const instanceResponse = await server.getLedgerEntries(instanceKey);

	if (!instanceResponse.entries || instanceResponse.entries.length === 0) {
		throw new Error("Contract not found on network");
	}

	const instanceEntry = instanceResponse.entries[0];
	if (!instanceEntry) {
		throw new Error("Contract instance entry is empty");
	}

	// The SDK already parses the XDR for us - val is LedgerEntryData
	const instanceData = instanceEntry.val;
	const executable = instanceData
		.contractData()
		.val()
		.instance()
		.executable();

	// Check executable type - SAC vs WASM
	const execType = executable.switch().name;

	if (execType === "contractExecutableStellarAsset") {
		// Stellar Asset Contract - uses built-in SEP-41 interface
		return { type: "stellar_asset" };
	}

	// WASM contract - fetch the WASM code
	const wasmHash = executable.wasmHash();

	// Step 2: Fetch the WASM code using the hash
	const wasmKey = xdr.LedgerKey.contractCode(
		new xdr.LedgerKeyContractCode({ hash: wasmHash }),
	);

	const wasmResponse = await server.getLedgerEntries(wasmKey);

	if (!wasmResponse.entries || wasmResponse.entries.length === 0) {
		throw new Error("Contract WASM not found on network");
	}

	const wasmEntry = wasmResponse.entries[0];
	if (!wasmEntry) {
		throw new Error("Contract WASM entry is empty");
	}
	const wasmData = wasmEntry.val;
	const wasmCode = wasmData.contractCode().code();

	return { type: "wasm", wasm: Buffer.from(wasmCode) };
}

/**
 * Get the standard SEP-41 Token Interface spec
 * This is used for Stellar Asset Contracts (SACs)
 */
function getStellarAssetContractSpec(): ContractSpec {
	return {
		functions: [
			{
				name: "allowance",
				signature: "allowance(Address,Address)",
				inputs: [
					{ name: "from", type: "Address" },
					{ name: "spender", type: "Address" },
				],
				outputs: [{ type: "i128" }],
				doc: "Returns the allowance for a spender",
			},
			{
				name: "approve",
				signature: "approve(Address,Address,i128,u32)",
				inputs: [
					{ name: "from", type: "Address" },
					{ name: "spender", type: "Address" },
					{ name: "amount", type: "i128" },
					{ name: "expiration_ledger", type: "u32" },
				],
				outputs: [],
				doc: "Set the allowance for a spender",
			},
			{
				name: "balance",
				signature: "balance(Address)",
				inputs: [{ name: "id", type: "Address" }],
				outputs: [{ type: "i128" }],
				doc: "Returns the balance of an address",
			},
			{
				name: "transfer",
				signature: "transfer(Address,Address,i128)",
				inputs: [
					{ name: "from", type: "Address" },
					{ name: "to", type: "Address" },
					{ name: "amount", type: "i128" },
				],
				outputs: [],
				doc: "Transfer tokens from one address to another",
			},
			{
				name: "transfer_from",
				signature: "transfer_from(Address,Address,Address,i128)",
				inputs: [
					{ name: "spender", type: "Address" },
					{ name: "from", type: "Address" },
					{ name: "to", type: "Address" },
					{ name: "amount", type: "i128" },
				],
				outputs: [],
				doc: "Transfer tokens using an allowance",
			},
			{
				name: "burn",
				signature: "burn(Address,i128)",
				inputs: [
					{ name: "from", type: "Address" },
					{ name: "amount", type: "i128" },
				],
				outputs: [],
				doc: "Burn tokens",
			},
			{
				name: "burn_from",
				signature: "burn_from(Address,Address,i128)",
				inputs: [
					{ name: "spender", type: "Address" },
					{ name: "from", type: "Address" },
					{ name: "amount", type: "i128" },
				],
				outputs: [],
				doc: "Burn tokens using an allowance",
			},
			{
				name: "decimals",
				signature: "decimals()",
				inputs: [],
				outputs: [{ type: "u32" }],
				doc: "Returns the number of decimals",
			},
			{
				name: "name",
				signature: "name()",
				inputs: [],
				outputs: [{ type: "String" }],
				doc: "Returns the token name",
			},
			{
				name: "symbol",
				signature: "symbol()",
				inputs: [],
				outputs: [{ type: "String" }],
				doc: "Returns the token symbol",
			},
		],
		events: [
			{
				name: "transfer",
				signature: "transfer(Address,Address,i128)",
				fields: [
					{ name: "from", type: "Address" },
					{ name: "to", type: "Address" },
					{ name: "amount", type: "i128" },
				],
				doc: "Emitted when tokens are transferred",
			},
			{
				name: "mint",
				signature: "mint(Address,i128)",
				fields: [
					{ name: "to", type: "Address" },
					{ name: "amount", type: "i128" },
				],
				doc: "Emitted when tokens are minted",
			},
			{
				name: "clawback",
				signature: "clawback(Address,i128)",
				fields: [
					{ name: "from", type: "Address" },
					{ name: "amount", type: "i128" },
				],
				doc: "Emitted when tokens are clawed back",
			},
			{
				name: "burn",
				signature: "burn(Address,i128)",
				fields: [
					{ name: "from", type: "Address" },
					{ name: "amount", type: "i128" },
				],
				doc: "Emitted when tokens are burned",
			},
		],
	};
}

/**
 * Fetch and parse a contract's specification from the network
 */
export async function fetchContractSpec(
	contractAddress: string,
	network: string,
): Promise<FetchContractSpecResult> {
	const networkPreset = NETWORK_PRESETS[network];

	if (!networkPreset) {
		return {
			success: false,
			error: `Unknown network: ${network}`,
		};
	}

	// Only Stellar networks are supported
	if (networkPreset.type !== "Stellar") {
		return {
			success: false,
			error: "Contract introspection is only supported for Stellar networks",
		};
	}

	try {
		// Fetch the contract executable info
		const execInfo = await fetchContractExecutable(
			contractAddress,
			networkPreset.rpcUrl,
		);

		// Handle Stellar Asset Contracts (SACs) - use standard SEP-41 interface
		if (execInfo.type === "stellar_asset") {
			return { success: true, spec: getStellarAssetContractSpec() };
		}

		// For WASM contracts, parse spec from WASM
		const contractSpec = Spec.fromWasm(execInfo.wasm);

		// Parse the spec entries
		const spec = parseSpecEntries(contractSpec.entries);

		return { success: true, spec };
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown error occurred";
		return {
			success: false,
			error: message,
		};
	}
}

/**
 * Get common token events (for contracts that follow standard patterns)
 * This is used as a fallback when we can't detect events from the spec
 */
export function getCommonTokenEvents(): ContractEvent[] {
	return [
		{
			name: "transfer",
			signature: "transfer(Address,Address,i128)",
			fields: [
				{ name: "from", type: "Address" },
				{ name: "to", type: "Address" },
				{ name: "amount", type: "i128" },
			],
			doc: "Transfer tokens between addresses",
		},
		{
			name: "mint",
			signature: "mint(Address,i128)",
			fields: [
				{ name: "to", type: "Address" },
				{ name: "amount", type: "i128" },
			],
			doc: "Mint new tokens",
		},
		{
			name: "burn",
			signature: "burn(Address,i128)",
			fields: [
				{ name: "from", type: "Address" },
				{ name: "amount", type: "i128" },
			],
			doc: "Burn tokens",
		},
	];
}
