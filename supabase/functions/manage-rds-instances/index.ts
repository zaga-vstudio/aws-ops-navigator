import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  RDSClient, CreateDBInstanceCommand, DeleteDBInstanceCommand,
  StartDBInstanceCommand, StopDBInstanceCommand, RebootDBInstanceCommand,
  CreateDBSubnetGroupCommand
} from "npm:@aws-sdk/client-rds";
import { resolveCredentials } from "../_shared/resolve-credentials.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RDSActionRequest {
  action: 'create' | 'delete' | 'start' | 'stop' | 'reboot';
  dbInstanceIdentifier?: string;
  dbName?: string;
  engine?: string;
  engineVersion?: string;
  instanceClass?: string;
  allocatedStorage?: number;
  masterUsername?: string;
  masterPassword?: string;
  publiclyAccessible?: boolean;
  roleName?: string;
  vpcId?: string;
  subnetIds?: string[];
  vpcSecurityGroupIds?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body: RDSActionRequest = await req.json();
    const { action, roleName } = body;

    console.log(`User ${user.id} requesting RDS action: ${action}`);

    const { data: credentials, error: credError } = await supabaseClient
      .rpc('get_user_aws_credentials', { user_id_param: user.id });

    if (credError || !credentials || credentials.length === 0) {
      return new Response(JSON.stringify({ error: 'AWS credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { access_key_id, secret_access_key, region } = credentials[0];

    const { credentials: awsCreds } = await resolveCredentials(
      supabaseClient, user.id, user.email || '',
      { accessKeyId: access_key_id, secretAccessKey: secret_access_key },
      region || 'us-east-1', roleName
    );

    const rdsClient = new RDSClient({
      region: region || 'us-east-1',
      credentials: awsCreds,
    });

    let result;

    switch (action) {
      case 'create': {
        const { dbInstanceIdentifier, dbName, engine = 'mysql', engineVersion,
          instanceClass = 'db.t3.micro', allocatedStorage = 20,
          masterUsername = 'admin', masterPassword, publiclyAccessible = false,
          subnetIds, vpcSecurityGroupIds } = body;
        if (!dbInstanceIdentifier || !masterPassword) {
          return new Response(JSON.stringify({ error: 'DB identifier and master password are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (masterPassword.length < 8) {
          return new Response(JSON.stringify({ error: 'Master password must be at least 8 characters' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Create DB Subnet Group if subnets provided
        let dbSubnetGroupName: string | undefined;
        if (subnetIds && subnetIds.length >= 2) {
          dbSubnetGroupName = `${dbInstanceIdentifier}-subnet-group`;
          await rdsClient.send(new CreateDBSubnetGroupCommand({
            DBSubnetGroupName: dbSubnetGroupName,
            DBSubnetGroupDescription: `Subnet group for ${dbInstanceIdentifier}`,
            SubnetIds: subnetIds,
          }));
          console.log(`Created DB subnet group: ${dbSubnetGroupName}`);
        }

        const createParams: any = {
          DBInstanceIdentifier: dbInstanceIdentifier, DBInstanceClass: instanceClass,
          Engine: engine, AllocatedStorage: allocatedStorage, MasterUsername: masterUsername,
          MasterUserPassword: masterPassword, PubliclyAccessible: publiclyAccessible,
          BackupRetentionPeriod: 7, MultiAZ: false, StorageType: 'gp2',
        };
        if (dbName) createParams.DBName = dbName;
        if (engineVersion) createParams.EngineVersion = engineVersion;
        if (dbSubnetGroupName) createParams.DBSubnetGroupName = dbSubnetGroupName;
        if (vpcSecurityGroupIds && vpcSecurityGroupIds.length > 0) createParams.VpcSecurityGroupIds = vpcSecurityGroupIds;
        result = await rdsClient.send(new CreateDBInstanceCommand(createParams));
        break;
      }
      case 'delete': {
        const { dbInstanceIdentifier } = body;
        if (!dbInstanceIdentifier) return new Response(JSON.stringify({ error: 'DB instance identifier is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        result = await rdsClient.send(new DeleteDBInstanceCommand({
          DBInstanceIdentifier: dbInstanceIdentifier, SkipFinalSnapshot: true, DeleteAutomatedBackups: true,
        }));
        break;
      }
      case 'start': {
        const { dbInstanceIdentifier } = body;
        if (!dbInstanceIdentifier) return new Response(JSON.stringify({ error: 'DB instance identifier is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        result = await rdsClient.send(new StartDBInstanceCommand({ DBInstanceIdentifier: dbInstanceIdentifier }));
        break;
      }
      case 'stop': {
        const { dbInstanceIdentifier } = body;
        if (!dbInstanceIdentifier) return new Response(JSON.stringify({ error: 'DB instance identifier is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        result = await rdsClient.send(new StopDBInstanceCommand({ DBInstanceIdentifier: dbInstanceIdentifier }));
        break;
      }
      case 'reboot': {
        const { dbInstanceIdentifier } = body;
        if (!dbInstanceIdentifier) return new Response(JSON.stringify({ error: 'DB instance identifier is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        result = await rdsClient.send(new RebootDBInstanceCommand({ DBInstanceIdentifier: dbInstanceIdentifier }));
        break;
      }
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, action, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('RDS action error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to execute RDS action', code: error.name || 'UnknownError' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
