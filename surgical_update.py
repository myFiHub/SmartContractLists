#!/usr/bin/env python3

"""
Surgical Update Script for Movement Smart Contract List

This script allows for targeted updates to specific contracts in the generated list
without regenerating the entire list from scratch.
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional

class SurgicalUpdater:
    def __init__(self, list_file: str, metadata_file: str):
        self.list_file = list_file
        self.metadata_file = metadata_file
        self.metadata = self.load_metadata()
    
    def load_metadata(self) -> Dict:
        """Load metadata configuration"""
        if os.path.exists(self.metadata_file):
            with open(self.metadata_file, 'r') as f:
                return json.load(f)
        return {"contractMetadata": {}}
    
    def load_list(self) -> Dict:
        """Load the current smart contract list"""
        with open(self.list_file, 'r') as f:
            return json.load(f)
    
    def save_list(self, data: Dict) -> None:
        """Save the updated smart contract list"""
        # Update timestamp
        data["timestamp"] = datetime.now().isoformat() + "Z"
        
        # Increment patch version
        if "version" in data:
            data["version"]["patch"] = data["version"].get("patch", 0) + 1
        
        with open(self.list_file, 'w') as f:
            json.dump(data, f, indent=2)
        
        print(f"✅ Updated list saved to {self.list_file}")
        print(f"📅 New timestamp: {data['timestamp']}")
        print(f"🔢 New version: {data['version']['major']}.{data['version']['minor']}.{data['version']['patch']}")
    
    def update_contract(self, address: str, module_name: str, updates: Dict) -> bool:
        """Update a specific contract with new metadata"""
        list_data = self.load_list()
        contracts = list_data.get("smartContracts", [])
        
        # Find the contract
        for i, contract in enumerate(contracts):
            if (contract.get("address") == address and 
                contract.get("moduleName") == module_name):
                
                # Apply updates
                for key, value in updates.items():
                    contract[key] = value
                
                print(f"✅ Updated contract: {contract.get('name', 'Unknown')}")
                print(f"   Address: {address}")
                print(f"   Module: {module_name}")
                print(f"   Updates: {list(updates.keys())}")
                
                # Save updated list
                self.save_list(list_data)
                return True
        
        print(f"❌ Contract not found: {address}:{module_name}")
        return False
    
    def update_contracts_by_address(self, address: str, updates: Dict) -> int:
        """Update all contracts for a specific address"""
        list_data = self.load_list()
        contracts = list_data.get("smartContracts", [])
        updated_count = 0
        
        for contract in contracts:
            if contract.get("address") == address:
                # Apply updates
                for key, value in updates.items():
                    contract[key] = value
                updated_count += 1
                print(f"✅ Updated: {contract.get('name', 'Unknown')}")
        
        if updated_count > 0:
            self.save_list(list_data)
            print(f"📊 Updated {updated_count} contracts for address {address}")
        else:
            print(f"❌ No contracts found for address: {address}")
        
        return updated_count
    
    def update_contracts_by_platform(self, platform: str, updates: Dict) -> int:
        """Update all contracts for a specific platform"""
        list_data = self.load_list()
        contracts = list_data.get("smartContracts", [])
        updated_count = 0
        
        for contract in contracts:
            if contract.get("platform") == platform:
                # Apply updates
                for key, value in updates.items():
                    contract[key] = value
                updated_count += 1
                print(f"✅ Updated: {contract.get('name', 'Unknown')}")
        
        if updated_count > 0:
            self.save_list(list_data)
            print(f"📊 Updated {updated_count} contracts for platform {platform}")
        else:
            print(f"❌ No contracts found for platform: {platform}")
        
        return updated_count
    
    def sync_with_metadata(self, address: str = None) -> int:
        """Sync contracts with metadata configuration"""
        list_data = self.load_list()
        contracts = list_data.get("smartContracts", [])
        updated_count = 0
        
        for contract in contracts:
            contract_address = contract.get("address", "")
            module_name = contract.get("moduleName", "")
            
            # Skip if address filter is specified and doesn't match
            if address and contract_address != address:
                continue
            
            # Get metadata for this contract
            contract_meta = self.metadata.get("contractMetadata", {}).get(contract_address, {})
            
            if not contract_meta:
                continue
            
            # Merge module-specific metadata if available
            if module_name and "modules" in contract_meta:
                module_meta = contract_meta["modules"].get(module_name, {})
                merged_meta = contract_meta.copy()
                merged_meta.update(module_meta)
            else:
                merged_meta = contract_meta
            
            # Apply metadata updates
            updates_applied = False
            
            # Update description
            if "description" in merged_meta:
                contract["description"] = merged_meta["description"]
                updates_applied = True
            
            # Update website
            if "website" in merged_meta:
                contract["website"] = merged_meta["website"]
                updates_applied = True
            
            # Update security info
            if "auditors" in merged_meta:
                if "security" not in contract:
                    contract["security"] = {}
                
                contract["security"]["auditScore"] = merged_meta.get("auditScore")
                contract["security"]["lastAuditDate"] = merged_meta.get("lastAuditDate", "")
                contract["security"]["securityLevel"] = merged_meta.get("securityLevel", "unknown")
                contract["security"]["penetrationTested"] = merged_meta.get("penetrationTested", False)
                contract["security"]["formalVerification"] = merged_meta.get("formalVerification", False)
                
                # Update function auditors
                for func in contract.get("functions", []):
                    func["auditors"] = merged_meta["auditors"]
                    func["audited"] = True
                
                updates_applied = True
            
            # Update other metadata fields
            for field in ["governance", "compliance", "performance", "interoperability"]:
                if field in merged_meta:
                    contract[field] = merged_meta[field]
                    updates_applied = True
            
            if updates_applied:
                updated_count += 1
                print(f"✅ Synced: {contract.get('name', 'Unknown')}")
        
        if updated_count > 0:
            self.save_list(list_data)
            print(f"📊 Synced {updated_count} contracts with metadata")
        else:
            print("❌ No contracts were updated")
        
        return updated_count

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Surgical updates to Movement Smart Contract List")
    parser.add_argument("--list", default="FiHub Movement Smart Contract List Generated.json", help="Smart contract list file")
    parser.add_argument("--metadata", default="contract_metadata.json", help="Metadata configuration file")
    parser.add_argument("--action", choices=["sync", "update-address", "update-platform", "update-contract"], required=True, help="Action to perform")
    parser.add_argument("--address", help="Contract address (for update-address or update-contract)")
    parser.add_argument("--module", help="Module name (for update-contract)")
    parser.add_argument("--platform", help="Platform name (for update-platform)")
    parser.add_argument("--updates", help="JSON string of updates to apply")
    
    args = parser.parse_args()
    
    updater = SurgicalUpdater(args.list, args.metadata)
    
    if args.action == "sync":
        updater.sync_with_metadata(args.address)
    
    elif args.action == "update-address":
        if not args.address or not args.updates:
            print("❌ --address and --updates are required for update-address")
            return
        
        updates = json.loads(args.updates)
        updater.update_contracts_by_address(args.address, updates)
    
    elif args.action == "update-platform":
        if not args.platform or not args.updates:
            print("❌ --platform and --updates are required for update-platform")
            return
        
        updates = json.loads(args.updates)
        updater.update_contracts_by_platform(args.platform, updates)
    
    elif args.action == "update-contract":
        if not args.address or not args.module or not args.updates:
            print("❌ --address, --module, and --updates are required for update-contract")
            return
        
        updates = json.loads(args.updates)
        updater.update_contract(args.address, args.module, updates)

if __name__ == "__main__":
    main()
