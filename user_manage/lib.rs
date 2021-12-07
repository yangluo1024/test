#![cfg_attr(not(feature = "std"), no_std)]

#[brush::contract]
mod user_manage {

    use brush::modifiers;
    use ownable::traits::*;

    use ink_storage::collections::{
        hashmap::Entry,
        HashMap as StorageHashMap,
    };
    use ink_storage::traits::{SpreadLayout, PackedLayout};
    use scale::{Encode, Decode};
    use ink_prelude::string::String;

    #[derive(Default, Debug, PartialEq, Eq, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct User {
        name: String,
        desc: String,  // description of user
        is_registered: bool, 
    }


    #[ink(storage)]
    #[derive(Default, OwnableStorage)]
    pub struct UserManage {
        #[OwnableStorageField]
        ownable: OwnableData,
        /// total users.
        total_users: u128,
        /// Mapping from `AccountId` to User Info.
        users: StorageHashMap<AccountId, User>,
        /// Mapping from `AccountId` to a bool value.
        managers: StorageHashMap<AccountId, bool>,
    }

    impl Ownable for UserManage {}

    impl UserManage {
        #[ink(constructor)]
        pub fn new() -> Self {
            let mut instance = Self::default();
            let caller = instance.env().caller();
            instance._init_with_owner(caller);
            instance
        }

        #[ink(message)]
        pub fn update_user_info(
            &mut self, 
            _name: String, 
            _desc: String, 
        ) -> bool {
            let caller = self.env().caller();
            let _user = User {
                name: _name,
                desc: _desc,
                is_registered: true,
            };

            match self.users.entry(caller) {
                Entry::Vacant(vacant) => {
                    self.total_users += 1;
                    vacant.insert(_user);
                },
                Entry::Occupied(mut occupied) => {
                    occupied.insert(_user);
                },
            }
            true
        }

        #[ink(message)]
        #[modifiers(only_owner)]
        pub fn set_manager(&mut self, _user: AccountId, _is_manager: bool) -> Result<(), OwnableError> {
            self.managers.insert(_user, _is_manager);
            Ok(())
        }

        #[ink(message)]
        pub fn is_manager(&self, _user: AccountId) -> bool {
            // default: false
            self.managers.get(&_user).copied().unwrap_or(false)
        }
    }
}
