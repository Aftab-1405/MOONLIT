import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Container,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { ExpandMoreIcon } from '@/components/icons';
import { LandingSection, Reveal, SectionHeading } from './LandingSection';
import { FAQS } from './landingContent';

export default function FaqSection() {
  const [expanded, setExpanded] = useState(null);

  return (
    <LandingSection id="faq">
      <Container maxWidth="md">
        <SectionHeading eyebrow="FAQ" title="Frequently asked questions." />

        <Reveal sx={{ mt: { xs: 5, md: 8 } }}>
          {FAQS.map((faq) => {
            const headerId = `${faq.id}-header`;
            const panelId = `${faq.id}-panel`;

            return (
              <Accordion
                key={faq.id}
                expanded={expanded === faq.id}
                onChange={(_event, isExpanded) => setExpanded(isExpanded ? faq.id : null)}
                disableGutters
                elevation={0}
                square
                slotProps={{ region: { 'aria-labelledby': headerId } }}
                sx={{
                  borderTop: '1px solid',
                  borderColor: 'border.subtle',
                  backgroundColor: 'transparent',
                  backgroundImage: 'none',
                  boxShadow: 'none',
                  '&::before': { display: 'none' },
                  '&:last-of-type': {
                    borderBottom: '1px solid',
                    borderColor: 'border.subtle',
                  },
                  '&.Mui-expanded': { m: 0 },
                }}
              >
                <AccordionSummary
                  id={headerId}
                  aria-controls={panelId}
                  expandIcon={<ExpandMoreIcon aria-hidden="true" />}
                  sx={{
                    minHeight: 72,
                    px: 0,
                    gap: 2,
                    '&.Mui-expanded': { minHeight: 72 },
                    '& .MuiAccordionSummary-content': { my: 2.5 },
                    '& .MuiAccordionSummary-content.Mui-expanded': { my: 2.5 },
                  }}
                >
                  <Typography component="span" sx={(theme) => theme.typography.displayXs}>
                    {faq.question}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 0, pt: 0, pb: 3.5 }}>
                  <Typography sx={(theme) => ({ ...theme.typography.bodyMd, color: 'text.secondary' })}>
                    {faq.answer}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Reveal>
      </Container>
    </LandingSection>
  );
}
