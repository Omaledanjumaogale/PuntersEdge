/** Isolate output publication failures after the quota-metered ingest commits.
 * A retry of either publication reads retained R2 data, without refetching sports APIs.
 */
export async function publishIngestOutputs({refreshEvidence,publishPreview,progress=()=>{}}){
 const stages=[['evidence_catalog',refreshEvidence],['public_preview',publishPreview]];
 const outcomes=await Promise.allSettled(stages.map(async([name,run])=>{progress(name);return run();}));
 const outputs=Object.fromEntries(outcomes.map((outcome,i)=>[stages[i][0],outcome.status==='fulfilled'?outcome.value:{failed:true,errorType:outcome.reason?.name??'Error'}]));
 return {evidence:outputs.evidence_catalog,publicPreview:outputs.public_preview,failedStages:outcomes.flatMap((outcome,i)=>outcome.status==='rejected'?[stages[i][0]]:[])};
}
