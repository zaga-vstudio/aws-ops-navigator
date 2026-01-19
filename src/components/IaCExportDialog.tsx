import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  Download, 
  Copy, 
  Check,
  FileCode,
  Server,
  Database,
  Shield,
  Network
} from "lucide-react";
import { toast } from "sonner";

interface EC2Instance {
  id: string;
  name: string;
  type: string;
  state: string;
  region: string;
  availabilityZone: string;
  publicIp?: string;
  privateIp?: string;
}

interface RDSDatabase {
  id: string;
  name: string;
  engine: string;
  engineVersion: string;
  instanceClass: string;
  allocatedStorage: number;
  region: string;
}

interface VPC {
  id: string;
  name: string;
  cidrBlock: string;
  state: string;
  isDefault: boolean;
  region: string;
}

interface Subnet {
  id: string;
  name: string;
  vpcId: string;
  cidrBlock: string;
  availabilityZone: string;
}

interface SecurityGroupRule {
  ipProtocol: string;
  fromPort?: number;
  toPort?: number;
  cidrIpv4?: string;
  cidrIpv6?: string;
  sourceSecurityGroupId?: string;
  prefixListId?: string;
  description?: string;
}

interface SecurityGroup {
  id: string;
  name: string;
  description: string;
  vpcId: string;
  inboundRules: SecurityGroupRule[];
  outboundRules: SecurityGroupRule[];
}

interface IaCExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ec2Instances: EC2Instance[];
  rdsDatabases: RDSDatabase[];
  vpcs: VPC[];
  subnets: Subnet[];
  securityGroups: SecurityGroup[];
}

type ExportFormat = "terraform" | "cloudformation";

export function IaCExportDialog({
  open,
  onOpenChange,
  ec2Instances,
  rdsDatabases,
  vpcs,
  subnets,
  securityGroups,
}: IaCExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("terraform");
  const [copied, setCopied] = useState(false);
  const [selectedResources, setSelectedResources] = useState({
    ec2: true,
    rds: true,
    vpc: true,
    subnets: true,
    securityGroups: true,
  });

  const generateTerraform = (): string => {
    let code = `# Generated Terraform Configuration
# Generated on: ${new Date().toISOString()}
# 
# This configuration represents your current AWS infrastructure.
# Review and modify as needed before applying.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "${vpcs[0]?.region || 'us-east-1'}"
}

`;

    // VPCs
    if (selectedResources.vpc && vpcs.length > 0) {
      code += `# ========================================
# VPC Configuration
# ========================================

`;
      vpcs.forEach((vpc) => {
        const resourceName = sanitizeName(vpc.name || vpc.id);
        code += `resource "aws_vpc" "${resourceName}" {
  cidr_block           = "${vpc.cidrBlock}"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${vpc.name || vpc.id}"
  }
}

`;
      });
    }

    // Subnets
    if (selectedResources.subnets && subnets.length > 0) {
      code += `# ========================================
# Subnet Configuration
# ========================================

`;
      subnets.forEach((subnet) => {
        const resourceName = sanitizeName(subnet.name || subnet.id);
        const vpcRef = getVpcReference(subnet.vpcId, vpcs);
        code += `resource "aws_subnet" "${resourceName}" {
  vpc_id            = ${vpcRef}
  cidr_block        = "${subnet.cidrBlock}"
  availability_zone = "${subnet.availabilityZone}"

  tags = {
    Name = "${subnet.name || subnet.id}"
  }
}

`;
      });
    }

    // Security Groups
    if (selectedResources.securityGroups && securityGroups.length > 0) {
      code += `# ========================================
# Security Group Configuration
# ========================================

`;
      securityGroups.forEach((sg) => {
        const resourceName = sanitizeName(sg.name || sg.id);
        const vpcRef = getVpcReference(sg.vpcId, vpcs);
        code += `resource "aws_security_group" "${resourceName}" {
  name        = "${sg.name}"
  description = "${sg.description || 'Managed by Terraform'}"
  vpc_id      = ${vpcRef}

`;
        // Generate ingress rules
        if (sg.inboundRules.length > 0) {
          sg.inboundRules.forEach((rule) => {
            const protocol = rule.ipProtocol === "-1" ? "-1" : rule.ipProtocol.toLowerCase();
            const fromPort = rule.ipProtocol === "-1" ? 0 : (rule.fromPort ?? 0);
            const toPort = rule.ipProtocol === "-1" ? 0 : (rule.toPort ?? 0);
            
            code += `  ingress {
`;
            if (rule.description) {
              code += `    description = "${rule.description}"
`;
            }
            code += `    from_port   = ${fromPort}
    to_port     = ${toPort}
    protocol    = "${protocol}"
`;
            if (rule.cidrIpv4) {
              code += `    cidr_blocks = ["${rule.cidrIpv4}"]
`;
            }
            if (rule.cidrIpv6) {
              code += `    ipv6_cidr_blocks = ["${rule.cidrIpv6}"]
`;
            }
            if (rule.sourceSecurityGroupId) {
              code += `    security_groups = ["${rule.sourceSecurityGroupId}"]
`;
            }
            if (rule.prefixListId) {
              code += `    prefix_list_ids = ["${rule.prefixListId}"]
`;
            }
            code += `  }

`;
          });
        }

        // Generate egress rules
        if (sg.outboundRules.length > 0) {
          sg.outboundRules.forEach((rule) => {
            const protocol = rule.ipProtocol === "-1" ? "-1" : rule.ipProtocol.toLowerCase();
            const fromPort = rule.ipProtocol === "-1" ? 0 : (rule.fromPort ?? 0);
            const toPort = rule.ipProtocol === "-1" ? 0 : (rule.toPort ?? 0);
            
            code += `  egress {
`;
            if (rule.description) {
              code += `    description = "${rule.description}"
`;
            }
            code += `    from_port   = ${fromPort}
    to_port     = ${toPort}
    protocol    = "${protocol}"
`;
            if (rule.cidrIpv4) {
              code += `    cidr_blocks = ["${rule.cidrIpv4}"]
`;
            }
            if (rule.cidrIpv6) {
              code += `    ipv6_cidr_blocks = ["${rule.cidrIpv6}"]
`;
            }
            if (rule.sourceSecurityGroupId) {
              code += `    security_groups = ["${rule.sourceSecurityGroupId}"]
`;
            }
            if (rule.prefixListId) {
              code += `    prefix_list_ids = ["${rule.prefixListId}"]
`;
            }
            code += `  }

`;
          });
        }

        code += `  tags = {
    Name = "${sg.name}"
  }
}

`;
      });
    }

    // EC2 Instances
    if (selectedResources.ec2 && ec2Instances.length > 0) {
      code += `# ========================================
# EC2 Instance Configuration
# ========================================

`;
      ec2Instances.forEach((instance) => {
        const resourceName = sanitizeName(instance.name || instance.id);
        code += `resource "aws_instance" "${resourceName}" {
  ami               = "ami-PLACEHOLDER" # Replace with actual AMI ID
  instance_type     = "${instance.type}"
  availability_zone = "${instance.availabilityZone}"

  # Note: Additional configuration (subnet, security groups, key pair, etc.)
  # should be added based on your requirements

  tags = {
    Name = "${instance.name || instance.id}"
  }
}

`;
      });
    }

    // RDS Instances
    if (selectedResources.rds && rdsDatabases.length > 0) {
      code += `# ========================================
# RDS Database Configuration
# ========================================

`;
      rdsDatabases.forEach((db) => {
        const resourceName = sanitizeName(db.name || db.id);
        code += `resource "aws_db_instance" "${resourceName}" {
  identifier           = "${db.id}"
  engine               = "${db.engine}"
  engine_version       = "${db.engineVersion}"
  instance_class       = "${db.instanceClass}"
  allocated_storage    = ${db.allocatedStorage}
  
  # Note: Additional configuration (username, password, subnet group, etc.)
  # should be added based on your requirements
  # 
  # IMPORTANT: Never store passwords in plain text!
  # Use AWS Secrets Manager or Terraform variables with sensitive flag

  skip_final_snapshot = true # Set to false for production

  tags = {
    Name = "${db.name || db.id}"
  }
}

`;
      });
    }

    return code;
  };

  const generateCloudFormation = (): string => {
    const resources: Record<string, any> = {};

    // VPCs
    if (selectedResources.vpc) {
      vpcs.forEach((vpc) => {
        const resourceName = sanitizeName(vpc.name || vpc.id);
        resources[`VPC${resourceName}`] = {
          Type: "AWS::EC2::VPC",
          Properties: {
            CidrBlock: vpc.cidrBlock,
            EnableDnsHostnames: true,
            EnableDnsSupport: true,
            Tags: [{ Key: "Name", Value: vpc.name || vpc.id }],
          },
        };
      });
    }

    // Subnets
    if (selectedResources.subnets) {
      subnets.forEach((subnet) => {
        const resourceName = sanitizeName(subnet.name || subnet.id);
        const vpcLogicalId = getVpcLogicalId(subnet.vpcId, vpcs);
        resources[`Subnet${resourceName}`] = {
          Type: "AWS::EC2::Subnet",
          Properties: {
            VpcId: vpcLogicalId ? { Ref: vpcLogicalId } : subnet.vpcId,
            CidrBlock: subnet.cidrBlock,
            AvailabilityZone: subnet.availabilityZone,
            Tags: [{ Key: "Name", Value: subnet.name || subnet.id }],
          },
        };
      });
    }

    // Security Groups
    if (selectedResources.securityGroups) {
      securityGroups.forEach((sg) => {
        const resourceName = sanitizeName(sg.name || sg.id);
        const vpcLogicalId = getVpcLogicalId(sg.vpcId, vpcs);
        
        // Generate ingress rules
        const ingressRules = sg.inboundRules.map((rule) => {
          const ruleObj: Record<string, any> = {
            IpProtocol: rule.ipProtocol === "-1" ? "-1" : rule.ipProtocol.toLowerCase(),
          };
          
          if (rule.ipProtocol !== "-1") {
            ruleObj.FromPort = rule.fromPort ?? 0;
            ruleObj.ToPort = rule.toPort ?? 0;
          }
          
          if (rule.cidrIpv4) {
            ruleObj.CidrIp = rule.cidrIpv4;
          }
          if (rule.cidrIpv6) {
            ruleObj.CidrIpv6 = rule.cidrIpv6;
          }
          if (rule.sourceSecurityGroupId) {
            ruleObj.SourceSecurityGroupId = rule.sourceSecurityGroupId;
          }
          if (rule.description) {
            ruleObj.Description = rule.description;
          }
          
          return ruleObj;
        });
        
        // Generate egress rules
        const egressRules = sg.outboundRules.map((rule) => {
          const ruleObj: Record<string, any> = {
            IpProtocol: rule.ipProtocol === "-1" ? "-1" : rule.ipProtocol.toLowerCase(),
          };
          
          if (rule.ipProtocol !== "-1") {
            ruleObj.FromPort = rule.fromPort ?? 0;
            ruleObj.ToPort = rule.toPort ?? 0;
          }
          
          if (rule.cidrIpv4) {
            ruleObj.CidrIp = rule.cidrIpv4;
          }
          if (rule.cidrIpv6) {
            ruleObj.CidrIpv6 = rule.cidrIpv6;
          }
          if (rule.sourceSecurityGroupId) {
            ruleObj.DestinationSecurityGroupId = rule.sourceSecurityGroupId;
          }
          if (rule.description) {
            ruleObj.Description = rule.description;
          }
          
          return ruleObj;
        });
        
        const sgProperties: Record<string, any> = {
          GroupDescription: sg.description || "Managed by CloudFormation",
          GroupName: sg.name,
          VpcId: vpcLogicalId ? { Ref: vpcLogicalId } : sg.vpcId,
          Tags: [{ Key: "Name", Value: sg.name }],
        };
        
        if (ingressRules.length > 0) {
          sgProperties.SecurityGroupIngress = ingressRules;
        }
        
        if (egressRules.length > 0) {
          sgProperties.SecurityGroupEgress = egressRules;
        }
        
        resources[`SecurityGroup${resourceName}`] = {
          Type: "AWS::EC2::SecurityGroup",
          Properties: sgProperties,
        };
      });
    }

    // EC2 Instances
    if (selectedResources.ec2) {
      ec2Instances.forEach((instance) => {
        const resourceName = sanitizeName(instance.name || instance.id);
        resources[`EC2Instance${resourceName}`] = {
          Type: "AWS::EC2::Instance",
          Properties: {
            ImageId: "ami-PLACEHOLDER",
            InstanceType: instance.type,
            AvailabilityZone: instance.availabilityZone,
            Tags: [{ Key: "Name", Value: instance.name || instance.id }],
          },
        };
      });
    }

    // RDS Instances
    if (selectedResources.rds) {
      rdsDatabases.forEach((db) => {
        const resourceName = sanitizeName(db.name || db.id);
        resources[`RDSInstance${resourceName}`] = {
          Type: "AWS::RDS::DBInstance",
          Properties: {
            DBInstanceIdentifier: db.id,
            Engine: db.engine,
            EngineVersion: db.engineVersion,
            DBInstanceClass: db.instanceClass,
            AllocatedStorage: db.allocatedStorage.toString(),
            MasterUsername: "PLACEHOLDER",
            MasterUserPassword: "PLACEHOLDER",
            Tags: [{ Key: "Name", Value: db.name || db.id }],
          },
          DeletionPolicy: "Snapshot",
        };
      });
    }

    const template = {
      AWSTemplateFormatVersion: "2010-09-09",
      Description: `CloudFormation template generated on ${new Date().toISOString()}. Review and modify before deploying.`,
      Resources: resources,
      Outputs: generateOutputs(resources),
    };

    return JSON.stringify(template, null, 2);
  };

  const generateOutputs = (resources: Record<string, any>) => {
    const outputs: Record<string, any> = {};
    
    Object.keys(resources).forEach((key) => {
      if (key.startsWith("VPC")) {
        outputs[`${key}Id`] = {
          Description: `ID of ${key}`,
          Value: { Ref: key },
          Export: { Name: { "Fn::Sub": `\${AWS::StackName}-${key}Id` } },
        };
      }
    });

    return outputs;
  };

  const sanitizeName = (name: string): string => {
    return name
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/^[0-9]/, "r$&")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  };

  const getVpcReference = (vpcId: string, vpcs: VPC[]): string => {
    const vpc = vpcs.find((v) => v.id === vpcId);
    if (vpc) {
      return `aws_vpc.${sanitizeName(vpc.name || vpc.id)}.id`;
    }
    return `"${vpcId}"`;
  };

  const getVpcLogicalId = (vpcId: string, vpcs: VPC[]): string | null => {
    const vpc = vpcs.find((v) => v.id === vpcId);
    if (vpc) {
      return `VPC${sanitizeName(vpc.name || vpc.id)}`;
    }
    return null;
  };

  const generatedCode = format === "terraform" ? generateTerraform() : generateCloudFormation();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    toast.success("Code copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const extension = format === "terraform" ? "tf" : "json";
    const filename = format === "terraform" 
      ? `infrastructure-${new Date().toISOString().split("T")[0]}.tf`
      : `cloudformation-${new Date().toISOString().split("T")[0]}.json`;
    
    const blob = new Blob([generatedCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${format === "terraform" ? "Terraform" : "CloudFormation"} file downloaded!`);
  };

  const resourceCounts = {
    ec2: ec2Instances.length,
    rds: rdsDatabases.length,
    vpc: vpcs.length,
    subnets: subnets.length,
    securityGroups: securityGroups.length,
  };

  const totalSelected = Object.entries(selectedResources)
    .filter(([key, selected]) => selected && resourceCounts[key as keyof typeof resourceCounts] > 0)
    .reduce((sum, [key]) => sum + resourceCounts[key as keyof typeof resourceCounts], 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5 text-primary" />
            Export Infrastructure as Code
          </DialogTitle>
          <DialogDescription>
            Generate Terraform or CloudFormation code from your current AWS infrastructure
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Resource Selection */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <h4 className="text-sm font-medium mb-3">Select Resources to Export</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="export-vpc"
                  checked={selectedResources.vpc}
                  onCheckedChange={(checked) =>
                    setSelectedResources((prev) => ({ ...prev, vpc: !!checked }))
                  }
                />
                <Label htmlFor="export-vpc" className="flex items-center gap-1.5 cursor-pointer">
                  <Network className="h-4 w-4 text-blue-500" />
                  VPCs
                  <Badge variant="secondary" className="ml-1">{resourceCounts.vpc}</Badge>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="export-subnets"
                  checked={selectedResources.subnets}
                  onCheckedChange={(checked) =>
                    setSelectedResources((prev) => ({ ...prev, subnets: !!checked }))
                  }
                />
                <Label htmlFor="export-subnets" className="flex items-center gap-1.5 cursor-pointer">
                  <Network className="h-4 w-4 text-cyan-500" />
                  Subnets
                  <Badge variant="secondary" className="ml-1">{resourceCounts.subnets}</Badge>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="export-sg"
                  checked={selectedResources.securityGroups}
                  onCheckedChange={(checked) =>
                    setSelectedResources((prev) => ({ ...prev, securityGroups: !!checked }))
                  }
                />
                <Label htmlFor="export-sg" className="flex items-center gap-1.5 cursor-pointer">
                  <Shield className="h-4 w-4 text-amber-500" />
                  Security Groups
                  <Badge variant="secondary" className="ml-1">{resourceCounts.securityGroups}</Badge>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="export-ec2"
                  checked={selectedResources.ec2}
                  onCheckedChange={(checked) =>
                    setSelectedResources((prev) => ({ ...prev, ec2: !!checked }))
                  }
                />
                <Label htmlFor="export-ec2" className="flex items-center gap-1.5 cursor-pointer">
                  <Server className="h-4 w-4 text-green-500" />
                  EC2
                  <Badge variant="secondary" className="ml-1">{resourceCounts.ec2}</Badge>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="export-rds"
                  checked={selectedResources.rds}
                  onCheckedChange={(checked) =>
                    setSelectedResources((prev) => ({ ...prev, rds: !!checked }))
                  }
                />
                <Label htmlFor="export-rds" className="flex items-center gap-1.5 cursor-pointer">
                  <Database className="h-4 w-4 text-purple-500" />
                  RDS
                  <Badge variant="secondary" className="ml-1">{resourceCounts.rds}</Badge>
                </Label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {totalSelected} resource{totalSelected !== 1 ? "s" : ""} will be exported
            </p>
          </div>

          {/* Format Tabs */}
          <Tabs value={format} onValueChange={(v) => setFormat(v as ExportFormat)} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="terraform" className="gap-2">
                  <img 
                    src="https://www.terraform.io/favicon.ico" 
                    alt="Terraform" 
                    className="h-4 w-4"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                  Terraform
                </TabsTrigger>
                <TabsTrigger value="cloudformation" className="gap-2">
                  <img 
                    src="https://aws.amazon.com/favicon.ico" 
                    alt="AWS" 
                    className="h-4 w-4"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                  CloudFormation
                </TabsTrigger>
              </TabsList>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            </div>

            <TabsContent value="terraform" className="flex-1 mt-4 overflow-hidden">
              <ScrollArea className="h-[350px] border rounded-lg bg-muted/50">
                <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words">
                  {generatedCode}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="cloudformation" className="flex-1 mt-4 overflow-hidden">
              <ScrollArea className="h-[350px] border rounded-lg bg-muted/50">
                <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words">
                  {generatedCode}
                </pre>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {/* Warning Notice */}
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              <strong>Important:</strong> This generated code is a starting point. Review and modify 
              placeholders (AMI IDs, passwords, etc.) before applying to your infrastructure.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
