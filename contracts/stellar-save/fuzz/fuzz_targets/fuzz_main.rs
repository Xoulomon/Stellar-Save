#![no_main]

use libfuzzer_sys::fuzz_target;
use soroban_sdk::{testutils::Address, Env, String};

fuzz_target!(|data: &[u8]| {
    let env = Env::default();
    let contract_id = env.register_contract(None, YourContract);

    // Fuzz common inputs
    if let Ok(input) = std::str::from_utf8(data) {
        let _ = env.invoke_contract::<String>(
            &contract_id,
            &soroban_sdk::symbol_short!("process_input"),
            vec![&env, String::from_str(&env, input)]
        );
    }
});