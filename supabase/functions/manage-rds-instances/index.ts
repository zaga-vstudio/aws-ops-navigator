import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  RDSClient, 
  CreateDBInstanceCommand,
  DeleteDBInstanceCommand,
  StartDBInstanceCommand,
  StopDBInstanceCommand,
  RebootDBInstanceCommand
} from "npm:@aws-sdk/client-rds";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RDSActionRequest {
  action: 'create' | 'delete' | 'start' | 'stop' | 'reboot';
  dbInstanceIdentifier?: string;
  // For create action
  dbName?: string;
  engine?: string;
  engineVersion?: string;
  instanceClass?: string;
  allocatedStorage?: number;
  masterUsername?: string;
  masterPassword?: string;
  publiclyAccessible?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${user.id} requesting RDS action`);

    // Get AWS credentials
    const { data: credentials, error: credError } = await supabaseClient
      .rpc('get_user_aws_credentials', { user_id_param: user.id });

    if (credError || !credentials || credentials.length === 0) {
      console.error('Credentials error:', credError);
      return new Response(
        JSON.stringify({ error: 'AWS credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { access_key_id, secret_access_key, region } = credentials[0];

    const rdsClient = new RDSClient({
      region: region || 'us-east-1',
      credentials: {
        accessKeyId: access_key_id,
        secretAccessKey: secret_access_key,
      },
    });

    const body: RDSActionRequest = await req.json();
    const { action } = body;

    console.log(`Executing RDS action: ${action}`);

    let result;

    switch (action) {
      case 'create': {
        const {
          dbInstanceIdentifier,
          dbName,
          engine = 'mysql',
          engineVersion,
          instanceClass = 'db.t3.micro',
          allocatedStorage = 20,
          masterUsername = 'admin',
          masterPassword,
          publiclyAccessible = false,
        } = body;

        if (!dbInstanceIdentifier || !masterPassword) {
          return new Response(
            JSON.stringify({ error: 'DB identifier and master password are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate password requirements
        if (masterPassword.length < 8) {
          return new Response(
            JSON.stringify({ error: 'Master password must be at least 8 characters' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const createParams: any = {
          DBInstanceIdentifier: dbInstanceIdentifier,
          DBInstanceClass: instanceClass,
          Engine: engine,
          AllocatedStorage: allocatedStorage,
          MasterUsername: masterUsername,
          MasterUserPassword: masterPassword,
          PubliclyAccessible: publiclyAccessible,
          BackupRetentionPeriod: 7,
          MultiAZ: false,
          StorageType: 'gp2',
        };

        if (dbName) {
          createParams.DBName = dbName;
        }

        if (engineVersion) {
          createParams.EngineVersion = engineVersion;
        }

        console.log('Creating RDS instance:', dbInstanceIdentifier);
        const createCommand = new CreateDBInstanceCommand(createParams);
        result = await rdsClient.send(createCommand);
        console.log('RDS instance creation initiated:', result.DBInstance?.DBInstanceIdentifier);
        break;
      }

      case 'delete': {
        const { dbInstanceIdentifier } = body;
        if (!dbInstanceIdentifier) {
          return new Response(
            JSON.stringify({ error: 'DB instance identifier is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Deleting RDS instance:', dbInstanceIdentifier);
        const deleteCommand = new DeleteDBInstanceCommand({
          DBInstanceIdentifier: dbInstanceIdentifier,
          SkipFinalSnapshot: true,
          DeleteAutomatedBackups: true,
        });
        result = await rdsClient.send(deleteCommand);
        console.log('RDS instance deletion initiated:', dbInstanceIdentifier);
        break;
      }

      case 'start': {
        const { dbInstanceIdentifier } = body;
        if (!dbInstanceIdentifier) {
          return new Response(
            JSON.stringify({ error: 'DB instance identifier is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Starting RDS instance:', dbInstanceIdentifier);
        const startCommand = new StartDBInstanceCommand({
          DBInstanceIdentifier: dbInstanceIdentifier,
        });
        result = await rdsClient.send(startCommand);
        console.log('RDS instance start initiated:', dbInstanceIdentifier);
        break;
      }

      case 'stop': {
        const { dbInstanceIdentifier } = body;
        if (!dbInstanceIdentifier) {
          return new Response(
            JSON.stringify({ error: 'DB instance identifier is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Stopping RDS instance:', dbInstanceIdentifier);
        const stopCommand = new StopDBInstanceCommand({
          DBInstanceIdentifier: dbInstanceIdentifier,
        });
        result = await rdsClient.send(stopCommand);
        console.log('RDS instance stop initiated:', dbInstanceIdentifier);
        break;
      }

      case 'reboot': {
        const { dbInstanceIdentifier } = body;
        if (!dbInstanceIdentifier) {
          return new Response(
            JSON.stringify({ error: 'DB instance identifier is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Rebooting RDS instance:', dbInstanceIdentifier);
        const rebootCommand = new RebootDBInstanceCommand({
          DBInstanceIdentifier: dbInstanceIdentifier,
        });
        result = await rdsClient.send(rebootCommand);
        console.log('RDS instance reboot initiated:', dbInstanceIdentifier);
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, action, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('RDS action error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to execute RDS action',
        code: error.name || 'UnknownError'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
