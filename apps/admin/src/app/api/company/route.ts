import { route } from '@/lib/api/handler';
import { companyForm, saveCompany } from '@/server/services/company';
import { revalidateFor } from '@/server/services/revalidate';
import { companySchema, type CompanyInput } from '@/server/validators/company';

export const GET = route({
  permission: 'settings.read',
  handler: async () => ({ company: await companyForm() }),
});

export const PUT = route<CompanyInput>({
  permission: 'settings.write',
  schema: companySchema,
  handler: async ({ body, audit }) => {
    await saveCompany(body);

    audit({
      action: 'UPDATE',
      entity: 'company',
      entityLabel: body.name,
      /* The whole record, not a diff. It is one row, it is small, and "what
         did the telephone number used to be" is a question somebody asks. */
      after: body as never,
    });

    /**
     * Everything, and `discovery` with it.
     *
     * The company's name, address and social links are in the footer of every
     * page and in the structured data on every page — and in llms.txt, the
     * sitemap's host and the enquiry emails. A change here is the widest
     * change this panel can make.
     */
    const push = await revalidateFor('company');
    return { company: await companyForm(), revalidated: push };
  },
});
