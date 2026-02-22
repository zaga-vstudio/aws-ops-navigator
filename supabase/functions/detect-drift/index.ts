import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { EC2Client, DescribeInstancesCommand, DescribeSecurityGroupsCommand, DescribeVpcsCommand } from "npm:@aws-sdk/client-ec2";
import { RDSClient, DescribeDBInstancesCommand } from "npm:@aws-sdk/client-rds";
import { resolveCredentials } from "../_shared/resolve-credentials.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AWSConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  sessionToken?: string;
}

function hashConfig(config: any): string {
  const str = JSON.stringify(config, Object.keys(config).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

function findChanges(previous: any, current: any, path = ''): any[] {
  const changes: any[] = [];
  
  const allKeys = new Set([...Object.keys(previous || {}), ...Object.keys(current || {})]);
  
  for (const key of allKeys) {
    const currentPath = path ? `${path}.${key}` : key;
    const prevVal = previous?.[key];
    const currVal = current?.[key];
    
    if (typeof prevVal === 'object' && typeof currVal === 'object' && prevVal !== null && currVal !== null) {
      if (Array.isArray(prevVal) && Array.isArray(currVal)) {
        if (JSON.stringify(prevVal) !== JSON.stringify(currVal)) {
          changes.push({ field: currentPath, previous: prevVal, current: currVal });
        }
      } else {
        changes.push(...findChanges(prevVal, currVal, currentPath));
      }
    } else if (prevVal !== currVal) {
      changes.push({ field: currentPath, previous: prevVal, current: currVal });
    }
  }
  
  return changes;
}

function determineSeverity(resourceType: string, changes: any[]): string {
  const criticalFields = ['securityGroups', 'ingressRules', 'egressRules', 'publiclyAccessible', 'iamInstanceProfile'];
  const warningFields = ['instanceType', 'vpcId', 'subnetId', 'engine', 'engineVersion'];
  
  for (const change of changes) {
    if (criticalFields.some(f => change.field.toLowerCase().includes(f.toLowerCase()))) {
      return 'critical';
    }
  }
  
  for (const change of changes) {
    if (warningFields.some(f => change.field.toLowerCase().includes(f.toLowerCase()))) {
      return 'warning';
    }
  }
  
  return 'info';
}

async function getEC2Resources(ec2Client: EC2Client): Promise<any[]> {
  const resources: any[] = [];
  const response = await ec2Client.send(new DescribeInstancesCommand({}));
  
  for (const reservation of response.Reservations || []) {
    for (const instance of reservation.Instances || []) {
      const nameTag = instance.Tags?.find(t => t.Key === 'Name');
      resources.push({
        resourceType: 'ec2',
        resourceId: instance.InstanceId,
        resourceName: nameTag?.Value || instance.InstanceId,
        configuration: {
          instanceType: instance.InstanceType,
          state: instance.State?.Name,
          vpcId: instance.VpcId,
          subnetId: instance.SubnetId,
          securityGroups: instance.SecurityGroups?.map(sg => sg.GroupId),
          publicIp: instance.PublicIpAddress,
          privateIp: instance.PrivateIpAddress,
          iamInstanceProfile: instance.IamInstanceProfile?.Arn,
          ebsOptimized: instance.EbsOptimized,
          monitoring: instance.Monitoring?.State,
        }
      });
    }
  }
  
  return resources;
}

async function getSecurityGroups(ec2Client: EC2Client): Promise<any[]> {
  const resources: any[] = [];
  const response = await ec2Client.send(new DescribeSecurityGroupsCommand({}));
  
  for (const sg of response.SecurityGroups || []) {
    resources.push({
      resourceType: 'security_group',
      resourceId: sg.GroupId,
      resourceName: sg.GroupName,
      configuration: {
        groupName: sg.GroupName,
        description: sg.Description,
        vpcId: sg.VpcId,
        ingressRules: sg.IpPermissions?.map(rule => ({
          protocol: rule.IpProtocol,
          fromPort: rule.FromPort,
          toPort: rule.ToPort,
          ipRanges: rule.IpRanges?.map(r => r.CidrIp),
          securityGroups: rule.UserIdGroupPairs?.map(g => g.GroupId),
        })),
        egressRules: sg.IpPermissionsEgress?.map(rule => ({
          protocol: rule.IpProtocol,
          fromPort: rule.FromPort,
          toPort: rule.ToPort,
          ipRanges: rule.IpRanges?.map(r => r.CidrIp),
          securityGroups: rule.UserIdGroupPairs?.map(g => g.GroupId),
        })),
      }
    });
  }
  
  return resources;
}

async function getRDSResources(rdsClient: RDSClient): Promise<any[]> {
  const resources: any[] = [];
  const response = await rdsClient.send(new DescribeDBInstancesCommand({}));
  
  for (const db of response.DBInstances || []) {
    resources.push({
      resourceType: 'rds',
      resourceId: db.DBInstanceIdentifier,
      resourceName: db.DBInstanceIdentifier,
      configuration: {
        engine: db.Engine,
        engineVersion: db.EngineVersion,
        instanceClass: db.DBInstanceClass,
        allocatedStorage: db.AllocatedStorage,
        publiclyAccessible: db.PubliclyAccessible,
        multiAz: db.MultiAZ,
        vpcSecurityGroups: db.VpcSecurityGroups?.map(sg => sg.VpcSecurityGroupId),
        storageEncrypted: db.StorageEncrypted,
        autoMinorVersionUpgrade: db.AutoMinorVersionUpgrade,
        deletionProtection: db.DeletionProtection,
      }
    });
  }
  
  return resources;
}

async function getVPCResources(ec2Client: EC2Client): Promise<any[]> {
  const resources: any[] = [];
  const response = await ec2Client.send(new DescribeVpcsCommand({}));
  
  for (const vpc of response.Vpcs || []) {
    const nameTag = vpc.Tags?.find(t => t.Key === 'Name');
    resources.push({
      resourceType: 'vpc',
      resourceId: vpc.VpcId,
      resourceName: nameTag?.Value || vpc.VpcId,
      configuration: {
        cidrBlock: vpc.CidrBlock,
        isDefault: vpc.IsDefault,
        state: vpc.State,
        enableDnsHostnames: vpc.Tags?.find(t => t.Key === 'EnableDnsHostnames')?.Value,
        enableDnsSupport: vpc.Tags?.find(t => t.Key === 'EnableDnsSupport')?.Value,
      }
    });
  }
  
  return resources;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'scan';
    const roleName = body.roleName;

    // Get AWS credentials
    const { data: creds, error: credsError } = await supabase.rpc('get_user_aws_credentials', { user_id_param: user.id });
    if (credsError || !creds || creds.length === 0) {
      return new Response(JSON.stringify({ error: 'AWS credentials not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const region = creds[0].region || 'us-east-1';

    const { credentials: awsCreds } = await resolveCredentials(
      supabase, user.id, user.email || '',
      { accessKeyId: creds[0].access_key_id, secretAccessKey: creds[0].secret_access_key },
      region, roleName
    );

    const clientConfig = {
      region,
      credentials: awsCreds,
    };

    const ec2Client = new EC2Client(clientConfig);
    const rdsClient = new RDSClient(clientConfig);

    if (action === 'scan') {
      // Fetch current AWS resources
      const [ec2Resources, sgResources, rdsResources, vpcResources] = await Promise.all([
        getEC2Resources(ec2Client).catch(() => []),
        getSecurityGroups(ec2Client).catch(() => []),
        getRDSResources(rdsClient).catch(() => []),
        getVPCResources(ec2Client).catch(() => []),
      ]);

      const allResources = [...ec2Resources, ...sgResources, ...rdsResources, ...vpcResources];
      const driftEvents: any[] = [];

      // Get existing snapshots
      const { data: existingSnapshots } = await supabase
        .from('resource_snapshots')
        .select('*')
        .eq('user_id', user.id);

      const snapshotMap = new Map(
        (existingSnapshots || []).map(s => [`${s.resource_type}:${s.resource_id}`, s])
      );

      // Compare and detect drift
      for (const resource of allResources) {
        const key = `${resource.resourceType}:${resource.resourceId}`;
        const existingSnapshot = snapshotMap.get(key);
        const currentHash = hashConfig(resource.configuration);

        if (existingSnapshot) {
          if (existingSnapshot.snapshot_hash !== currentHash) {
            const changes = findChanges(existingSnapshot.configuration, resource.configuration);
            
            if (changes.length > 0) {
              const severity = determineSeverity(resource.resourceType, changes);
              
              const { data: existingDrift } = await supabase
                .from('drift_events')
                .select('id')
                .eq('user_id', user.id)
                .eq('resource_id', resource.resourceId)
                .eq('acknowledged', false)
                .single();

              if (!existingDrift) {
                const { data: driftEvent, error: driftError } = await supabase
                  .from('drift_events')
                  .insert({
                    user_id: user.id,
                    resource_type: resource.resourceType,
                    resource_id: resource.resourceId,
                    resource_name: resource.resourceName,
                    previous_hash: existingSnapshot.snapshot_hash,
                    current_hash: currentHash,
                    changes: changes,
                    severity: severity,
                  })
                  .select()
                  .single();

                if (!driftError && driftEvent) {
                  driftEvents.push(driftEvent);
                }
              }
            }
          }
        } else {
          await supabase
            .from('resource_snapshots')
            .upsert({
              user_id: user.id,
              resource_type: resource.resourceType,
              resource_id: resource.resourceId,
              snapshot_hash: currentHash,
              configuration: resource.configuration,
              source: 'initial',
            }, {
              onConflict: 'user_id,resource_type,resource_id'
            });
        }
      }

      const { data: allDriftEvents } = await supabase
        .from('drift_events')
        .select('*')
        .eq('user_id', user.id)
        .order('detected_at', { ascending: false });

      return new Response(JSON.stringify({
        success: true,
        driftEvents: allDriftEvents || [],
        newDriftCount: driftEvents.length,
        resourcesScanned: allResources.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'acknowledge') {
      const { driftId } = body;
      if (!driftId) {
        return new Response(JSON.stringify({ error: 'Drift ID required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { error: updateError } = await supabase
        .from('drift_events')
        .update({ 
          acknowledged: true, 
          acknowledged_at: new Date().toISOString() 
        })
        .eq('id', driftId)
        .eq('user_id', user.id);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'accept') {
      const { driftId } = body;
      if (!driftId) {
        return new Response(JSON.stringify({ error: 'Drift ID required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: driftEvent, error: driftError } = await supabase
        .from('drift_events')
        .select('*')
        .eq('id', driftId)
        .eq('user_id', user.id)
        .single();

      if (driftError || !driftEvent) {
        return new Response(JSON.stringify({ error: 'Drift event not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await supabase
        .from('resource_snapshots')
        .update({ 
          snapshot_hash: driftEvent.current_hash,
          source: 'accepted_drift',
          created_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('resource_type', driftEvent.resource_type)
        .eq('resource_id', driftEvent.resource_id);

      await supabase
        .from('drift_events')
        .update({ 
          acknowledged: true, 
          acknowledged_at: new Date().toISOString() 
        })
        .eq('id', driftId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Drift detection error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
