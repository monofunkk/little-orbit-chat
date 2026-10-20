import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getSnapshot } from './audit.functions';

export const snapshotOptions=queryOptions({queryKey:['audit-platform'],queryFn:()=>getSnapshot(),staleTime:0});
export function useSnapshot(){ return useSuspenseQuery(snapshotOptions).data; }
export function useAction<T,R>(fn:(data:T)=>Promise<R>){const client=useQueryClient();return useMutation({mutationFn:fn,onSuccess:async()=>{await client.invalidateQueries({queryKey:snapshotOptions.queryKey})},onError:(e:Error)=>toast.error(e.message)});}