import {CostClass,costClassLabels} from '@/lib/cost-class';
import {ReferenceSelect} from './ReferenceSelect';
export function CostClassSelect({value,onChange,disabled,label='費用の区分'}:{value:CostClass;onChange:(value:CostClass)=>void;disabled?:boolean;label?:string}){
  return <ReferenceSelect allowEmpty={false} label={label} value={value} options={Object.entries(costClassLabels).map(([id,name])=>({id,name}))} disabled={disabled} onChange={value=>{if(value)onChange(value as CostClass);}} />;
}
