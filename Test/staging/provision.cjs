const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const REGION='us-east-2', ACCOUNT='011820201589', NAME='calendarfly-staging', PREFIX='calendarfly_staging_';
const dir=__dirname, privateDir=path.join(dir,'private'); fs.mkdirSync(privateDir,{recursive:true});
const stateFile=path.join(dir,'state.json');
const state=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):{account:ACCOUNT,region:REGION,name:NAME,bucket:`${NAME}-${ACCOUNT}-${REGION}`};
if(state.account!==ACCOUNT || state.name!==NAME) throw new Error('Unexpected staging state');
const save=()=>fs.writeFileSync(stateFile,JSON.stringify(state,null,2));
const credsFile=path.join(privateDir,'credentials.json');
if(!fs.existsSync(credsFile)) fs.writeFileSync(credsFile,JSON.stringify({STAGING_ACCESS_KEY:crypto.randomBytes(32).toString('hex'),JWT_SECRET:crypto.randomBytes(48).toString('hex'),SESSION_SECRET:crypto.randomBytes(48).toString('hex'),ADMIN_PASSWORD:crypto.randomBytes(24).toString('hex')},null,2));
const credentials=JSON.parse(fs.readFileSync(credsFile,'utf8'));
function aws(service,operation,input={},optional=false) {
 const file=path.join(privateDir,'request.json'); fs.writeFileSync(file,JSON.stringify(input));
 const r=spawnSync('aws',[service,operation,'--region',REGION,'--cli-input-json','file://'+file,'--output','json','--no-cli-pager'],{encoding:'utf8',maxBuffer:8*1024*1024,windowsHide:true});
 fs.unlinkSync(file);
 if(r.status!==0) { if(optional && /NotFound|NoSuchEntity|NoSuchBucket|ParameterNotFound|ResourceNotFound/.test(r.stderr||''))return null; throw new Error(`${service} ${operation} failed: ${(r.stderr||r.error?.message||'').slice(0,1400)}`); }
 return r.stdout.trim()?JSON.parse(r.stdout):{};
}
function run(command,args,options={}) { const r=spawnSync(command,args,{encoding:'utf8',windowsHide:true,...options}); if(r.status!==0)throw new Error(command+' failed: '+(r.stderr||r.error?.message||'')); return r.stdout; }
function owned(tags) { if(!tags?.some(t=>(t.Key||t.key)==='ManagedBy'&&(t.Value||t.value)==='CalendarFlyStaging'))throw new Error('Existing resource is not marked as staging-owned'); }
const tags=[{Key:'ManagedBy',Value:'CalendarFlyStaging'},{Key:'Environment',Value:'staging'}];
const identity=aws('sts','get-caller-identity'); if(identity.Account!==ACCOUNT)throw new Error('Wrong AWS account');
const mode=process.argv[2];
if(mode==='infra') {
 const repo=aws('ecr','describe-repositories',{repositoryNames:[NAME]},true);
 if(repo)owned(aws('ecr','list-tags-for-resource',{resourceArn:repo.repositories[0].repositoryArn}).tags);
 else aws('ecr','create-repository',{repositoryName:NAME,imageTagMutability:'IMMUTABLE',imageScanningConfiguration:{scanOnPush:true},tags});
 state.repository=`${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/${NAME}`; save();
 let bucket=aws('s3api','get-bucket-location',{Bucket:state.bucket},true);
 if(bucket)owned(aws('s3api','get-bucket-tagging',{Bucket:state.bucket}).TagSet);
 else {aws('s3api','create-bucket',{Bucket:state.bucket,CreateBucketConfiguration:{LocationConstraint:REGION}}); aws('s3api','put-bucket-tagging',{Bucket:state.bucket,Tagging:{TagSet:tags}});}
 aws('s3api','put-public-access-block',{Bucket:state.bucket,PublicAccessBlockConfiguration:{BlockPublicAcls:true,IgnorePublicAcls:true,BlockPublicPolicy:true,RestrictPublicBuckets:true}});
 aws('s3api','put-bucket-encryption',{Bucket:state.bucket,ServerSideEncryptionConfiguration:{Rules:[{ApplyServerSideEncryptionByDefault:{SSEAlgorithm:'AES256'}}]}});
 const schemas=JSON.parse(fs.readFileSync(path.join(dir,'tables.json'),'utf8'));
 for(const table of schemas) {
   if(!table.TableName.startsWith(PREFIX))throw new Error('Refusing non-staging table');
   const existing=aws('dynamodb','describe-table',{TableName:table.TableName},true);
   if(existing)owned(aws('dynamodb','list-tags-of-resource',{ResourceArn:existing.Table.TableArn}).Tags);
   else aws('dynamodb','create-table',{...table,Tags:tags});
   console.log('Ready table: '+table.TableName);
 }
 state.tables=schemas.map(t=>t.TableName); save();
 for(const [key,value] of Object.entries(credentials)) {
   const parameter=`/${NAME}/${key}`;
   const existing=aws('ssm','get-parameter',{Name:parameter},true);
   if(existing)owned(aws('ssm','list-tags-for-resource',{ResourceType:'Parameter',ResourceId:parameter}).TagList);
   else aws('ssm','put-parameter',{Name:parameter,Value:value,Type:'SecureString',Tags:tags});
 }
 const role=(suffix,principal)=>{
   const RoleName=NAME+'-'+suffix;
   let value=aws('iam','get-role',{RoleName},true);
   if(value)owned(value.Role.Tags);
   else value=aws('iam','create-role',{RoleName,AssumeRolePolicyDocument:JSON.stringify({Version:'2012-10-17',Statement:[{Effect:'Allow',Principal:{Service:principal},Action:'sts:AssumeRole'}]}),Tags:tags});
   return value.Role.Arn;
 };
 state.accessRole=role('ecr-access','build.apprunner.amazonaws.com');
 aws('iam','put-role-policy',{RoleName:NAME+'-ecr-access',PolicyName:'staging-ecr-only',PolicyDocument:JSON.stringify({Version:'2012-10-17',Statement:[{Effect:'Allow',Action:'ecr:GetAuthorizationToken',Resource:'*'},{Effect:'Allow',Action:['ecr:BatchGetImage','ecr:GetDownloadUrlForLayer','ecr:BatchCheckLayerAvailability','ecr:DescribeImages'],Resource:`arn:aws:ecr:${REGION}:${ACCOUNT}:repository/${NAME}`} ]})});
 state.instanceRole=role('runtime','tasks.apprunner.amazonaws.com');
 const policy={Version:'2012-10-17',Statement:[
 {Effect:'Allow',Action:['dynamodb:GetItem','dynamodb:PutItem','dynamodb:UpdateItem','dynamodb:DeleteItem','dynamodb:Query','dynamodb:Scan','dynamodb:BatchGetItem','dynamodb:BatchWriteItem','dynamodb:TransactWriteItems','dynamodb:DescribeTable'],Resource:[`arn:aws:dynamodb:${REGION}:${ACCOUNT}:table/${PREFIX}*`,`arn:aws:dynamodb:${REGION}:${ACCOUNT}:table/${PREFIX}*/index/*`]},
 {Effect:'Allow',Action:['s3:ListBucket'],Resource:`arn:aws:s3:::${state.bucket}`},
 {Effect:'Allow',Action:['s3:GetObject','s3:PutObject','s3:DeleteObject'],Resource:`arn:aws:s3:::${state.bucket}/*`},
 {Effect:'Allow',Action:['ssm:GetParameters'],Resource:`arn:aws:ssm:${REGION}:${ACCOUNT}:parameter/${NAME}/*`}
 ]};
 aws('iam','put-role-policy',{RoleName:NAME+'-runtime',PolicyName:'staging-data-only',PolicyDocument:JSON.stringify(policy)});
 const scaling=aws('apprunner','create-auto-scaling-configuration',{AutoScalingConfigurationName:NAME,MinSize:1,MaxSize:1,MaxConcurrency:20,Tags:tags});
 state.scaling=scaling.AutoScalingConfiguration.AutoScalingConfigurationArn;save();console.log('Staging-only infrastructure prepared.');
} else if(mode==='deploy') {
 if(!state.repository||!state.instanceRole)throw new Error('Run infra first');
 state.imageTag='test-'+Date.now();save();
 run('docker',['build','--platform','linux/amd64','-t',state.repository+':'+state.imageTag,path.join(dir,'build')],{stdio:'inherit'});
 const password=spawnSync('aws',['ecr','get-login-password','--region',REGION],{encoding:'utf8',windowsHide:true});
 if(password.status!==0)throw new Error('ECR login failed');
 run('docker',['login','--username','AWS','--password-stdin',`${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com`],{input:password.stdout});
 run('docker',['push',state.repository+':'+state.imageTag],{stdio:'inherit'});
 const env={APP_ENV:'staging',NODE_ENV:'production',PORT:'5000',AWS_REGION:REGION,AWS_REGION_S3:REGION,STAGING_TABLE_PREFIX:PREFIX,S3_BUCKET_NAME:state.bucket,S3_BUCKET:state.bucket,ADMIN_USERNAME:'staging-admin',...(state.url?{FRONTEND_URL:state.url}:{})};
 const secrets=Object.fromEntries(Object.keys(credentials).map(key=>[key,`arn:aws:ssm:${REGION}:${ACCOUNT}:parameter/${NAME}/${key}`]));
 const SourceConfiguration={AutoDeploymentsEnabled:false,AuthenticationConfiguration:{AccessRoleArn:state.accessRole},ImageRepository:{ImageIdentifier:state.repository+':'+state.imageTag,ImageRepositoryType:'ECR',ImageConfiguration:{Port:'5000',RuntimeEnvironmentVariables:env,RuntimeEnvironmentSecrets:secrets}}};
 if(state.serviceArn){const current=aws('apprunner','describe-service',{ServiceArn:state.serviceArn});if(current.Service.ServiceName!==NAME)throw new Error('Wrong service');aws('apprunner','update-service',{ServiceArn:state.serviceArn,SourceConfiguration});}
 else {const result=aws('apprunner','create-service',{ServiceName:NAME,SourceConfiguration,InstanceConfiguration:{Cpu:'256',Memory:'512',InstanceRoleArn:state.instanceRole},AutoScalingConfigurationArn:state.scaling,HealthCheckConfiguration:{Protocol:'HTTP',Path:'/api/health',Interval:10,Timeout:5,HealthyThreshold:1,UnhealthyThreshold:5},Tags:tags});state.serviceArn=result.Service.ServiceArn;state.url='https://'+result.Service.ServiceUrl;save();}
 console.log('Staging deployment requested: '+state.url);
} else if(mode==='status') {
 if(!state.serviceArn)throw new Error('No staging service created');
 const {Service}=aws('apprunner','describe-service',{ServiceArn:state.serviceArn});
 if(Service.ServiceName!==NAME)throw new Error('Wrong service');
 console.log(JSON.stringify({name:Service.ServiceName,status:Service.Status,url:'https://'+Service.ServiceUrl}));
} else if(mode==='configure-origin') {
 const {Service}=aws('apprunner','describe-service',{ServiceArn:state.serviceArn});
 if(Service.ServiceName!==NAME || Service.Status!=='RUNNING')throw new Error('Staging must be running');
 const SourceConfiguration=Service.SourceConfiguration;
 SourceConfiguration.ImageRepository.ImageConfiguration.RuntimeEnvironmentVariables.FRONTEND_URL=state.url;
 aws('apprunner','update-service',{ServiceArn:state.serviceArn,SourceConfiguration});
 aws('s3api','put-bucket-cors',{Bucket:state.bucket,CORSConfiguration:{CORSRules:[{AllowedOrigins:[state.url],AllowedMethods:['GET','PUT','HEAD'],AllowedHeaders:['*'],ExposeHeaders:['ETag'],MaxAgeSeconds:300}]}});
 console.log('Staging origin and bucket CORS configured.');
} else {throw new Error('Use infra, deploy, status, or configure-origin');}
