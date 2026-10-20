import { describe,it,expect } from 'vitest';
import { canSubmit,editableAudit,validateReview,type ChecklistItem } from '@/lib/domain';
const item:ChecklistItem={id:'one',rcaId:'rca',descripcion:'Registro',categoria:'Documental',evidencia:'Documental',referencia:'4.2'};
describe('Audit workflow',()=>{
 it('requires every item before submitting',()=>{expect(canSubmit([item],[null])).toBe(false);expect(canSubmit([item],['cumple'])).toBe(true);expect(canSubmit([],[])).toBe(false);});
 it('accepts no aplica as a completed answer',()=>{expect(canSubmit([item],['no_aplica'])).toBe(true);});
 it('locks audits after submission',()=>{expect(editableAudit('En revisión')).toBe(false);expect(editableAudit('Aprobada')).toBe(false);expect(editableAudit('Rechazada')).toBe(true);});
 it('requires a comment when returning an audit',()=>{expect(()=>validateReview('En revisión',false,' ')).toThrow();expect(()=>validateReview('En revisión',false,'Corregir evidencia')).not.toThrow();});
 it('only reviews submitted audits',()=>{expect(()=>validateReview('Asignada',true,'')).toThrow();expect(()=>validateReview('En revisión',true,'')).not.toThrow();});
});