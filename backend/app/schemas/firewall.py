from pydantic import BaseModel, Field
from typing import List, Optional

class FirewallRuleData(BaseModel):
    rule_name: str
    rule_description: Optional[str] = ""
    direction: str = "Inbound"
    rule_action: str = "Allow"
    profile: str = "Any"
    protocol: str = "Any"
    local_port: str = "Any"
    remote_port: str = "Any"
    local_address: str = "Any"
    remote_address: str = "Any"
    program_path: str = "Any"
    service_name: str = "Any"
    icmp_type: str = "Any"
    icmp_code: str = "Any"
    authentication: str = "NotRequired"
    encryption: str = "NotRequired"
    predefined_group: str = ""
    enabled: str = "True"
    edge_traversal: str = "Block"
    interface_types: str = "Any"

class FirewallBulkCreateRequest(BaseModel):
    vm_ids: List[str]
    rule_data: FirewallRuleData

class FirewallBulkResponse(BaseModel):
    total: int
    success_count: int
    failure_count: int
    results: List[dict] # [{vm_id: str, success: bool, message: str}]
