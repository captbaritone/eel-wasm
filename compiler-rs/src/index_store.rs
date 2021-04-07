use indexmap::map::Entry;
use indexmap::IndexMap;
use std::hash::Hash;

#[derive(Default)]
pub struct IndexStore<T: Eq + Hash> {
    map: IndexMap<T, u32>,
}

impl<T: Eq + Hash> IndexStore<T> {
    pub fn new() -> Self {
        IndexStore {
            map: IndexMap::new(),
        }
    }
    pub fn get(&mut self, key: T) -> u32 {
        let next = self.map.len() as u32;
        match self.map.entry(key) {
            Entry::Occupied(entry) => entry.get().clone(),
            Entry::Vacant(entry) => {
                entry.insert(next);
                next
            }
        }
    }

    // TODO: Return iter?
    pub fn keys(&self) -> Vec<&T> {
        self.map.keys().collect()
    }
}
