"""Rebuild the synthetic PDF sources used by Pelagic Labs. Requires reportlab.
The generated anchors are native PDF coordinates consumed by Aster's demo builder.
"""
from pathlib import Path
import json
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color

OUT=Path('output/pdf'); OUT.mkdir(parents=True,exist_ok=True)
NAVY='#102334'; TEAL='#168C91'; INK='#233E50'; MUTED='#597382'; GOLD='#E0A745'
W,H=612,792
sources=[]

def create(slug,title,subtitle,pages):
    file=OUT/(slug+'.pdf'); c=canvas.Canvas(str(file),pagesize=(W,H),invariant=1)
    c.setTitle(title); c.setAuthor('Pelagic Labs - fictional Aster demo'); c.setSubject('Synthetic demonstration data; not a scientific or financial recommendation.')
    annotations=[]
    def text(x,y,t,size=11,color=INK,font='Helvetica'):
        c.setFillColor(HexColor(color));c.setFont(font,size);c.drawString(x,y,t)
    def line(x,y,w,color=TEAL):
        c.setStrokeColor(HexColor(color));c.setLineWidth(1.1);c.line(x,y,x+w,y)
    for i,page in enumerate(pages):
        c.setFillColor(HexColor('#F5F8FA'));c.rect(0,0,W,H,fill=1,stroke=0)
        c.setFillColor(HexColor(NAVY));c.rect(0,650,W,142,fill=1,stroke=0)
        text(42,755,'PELAGIC / LABS',13,'#86D9D3','Helvetica-Bold')
        text(42,722,title,26,'#FFFFFF','Helvetica-Bold')
        text(42,698,subtitle,11,'#C1D7E2')
        text(42,671,f'FIELD DOSSIER {slug.upper()}   /   {i+1:02d}',9,'#86D9D3')
        text(42,618,page['heading'],21,INK,'Helvetica-Bold')
        y=584
        for paragraph in page['paragraphs']:
            for row in paragraph:
                text(42,y,row);y-=17
            y-=12
        if 'metrics' in page:
            y-=4
            for j,(value,label) in enumerate(page['metrics']):
                x=42+j*178;c.setFillColor(HexColor('#E2EEF1'));c.roundRect(x,y-84,164,82,7,fill=1,stroke=0)
                text(x+14,y-32,value,25,TEAL,'Helvetica-Bold');text(x+14,y-57,label,10,MUTED)
            y-=120
        if 'table' in page:
            headers,rows=page['table'];widths=[210,140,178];x=42
            c.setFillColor(HexColor(NAVY));c.rect(42,y-24,528,26,fill=1,stroke=0)
            for h,width in zip(headers,widths):text(x+10,y-15,h,10,'#FFFFFF','Helvetica-Bold');x+=width
            y-=27
            for n,row in enumerate(rows):
                if n%2==0:c.setFillColor(HexColor('#E9F0F3'));c.rect(42,y-24,528,25,fill=1,stroke=0)
                x=42
                for value,width in zip(row,widths):text(x+10,y-15,str(value),10);x+=width
                y-=25
            y-=26
        if 'bars' in page:
            for label,value in page['bars']:
                text(42,y,label,11);c.setFillColor(HexColor('#DCE8EE'));c.roundRect(192,y-2,310,10,4,fill=1,stroke=0)
                c.setFillColor(HexColor(TEAL));c.roundRect(192,y-2,310*value/100,10,4,fill=1,stroke=0);text(518,y,str(value)+'%',10);y-=32
            y-=18
        for anchor in page.get('anchors',[]):
            quote,kind,comment=anchor
            text(42,y,quote,11,INK,'Helvetica-Bold')
            width=c.stringWidth(quote,'Helvetica-Bold',11)
            annotations.append(dict(page=i+1,kind=kind,quote=quote,comment=comment,quads=[[dict(x=40,y=y-3),dict(x=44+width,y=y-3),dict(x=44+width,y=y+12),dict(x=40,y=y+12)]],points=[]))
            y-=35
        if page.get('ink'):
            text(42,y,'Review zone: confirm sampling assumptions before approving expansion.',10,MUTED)
            annotations.append(dict(page=i+1,kind='ink',quote='',comment='Keep the decision tied to the six-site baseline, not a regional claim.',quads=[],points=[dict(x=405,y=y+10),dict(x=423,y=y+3),dict(x=450,y=y+27)]))
            y-=36
        if y<100:raise ValueError(f'Page overflow: {slug} page {i+1}, y={y}')
        line(42,78,528,'#B8CCD7');text(42,58,'FICTIONAL DEMO  /  All names, observations and values are synthetic.',9,MUTED)
        text(42,42,'Use the Aster notes and workbooks to inspect this demonstration.',9,MUTED);text(527,42,f'{i+1} / {len(pages)}',9,MUTED)
        c.showPage()
    c.save();sources.append(dict(file=file.name,title=title,annotations=annotations))

create('reef-baseline','Reef recovery baseline','Project Tideglass / Six sites / Review edition',[
 dict(heading='A promising signal, with limits',paragraphs=[['Pelagic Labs is a fictional team testing a small reef-restoration program.','Six sites were observed before and after a twelve-week nursery intervention.'],['This dossier supports a planning exercise. The values are designed to connect','notes, workbooks, charts, tasks and source evidence in the Aster demo.']],metrics=[('72 > 89%','Nursery survival'),('12 > 18','Fish per transect'),('6 sites','A bounded sample')],anchors=[('Nursery survival increased from 72% to 89%.','highlight','Supports the Tideglass review decision; see the Ecology workbook.'),('The six-site sample does not establish regional causality.','underline','Keep this limitation in the decision note and RAG context.')],ink=True),
 dict(heading='Where recovery is uneven',paragraphs=[['Every site has the same observation window and a paired before/after record.','Coverage is illustrative and not a substitute for real field calibration.']],table=(['Site','Before survival','After survival'],[['Aster Cove','68%','88%'],['Beacon Shoal','70%','90%'],['Coral Steps','74%','92%'],['Drift Garden','72%','87%'],['Ember Reef','76%','91%'],['Farwater','72%','86%']]),anchors=[('Farwater requires a second inspection before expansion.','comment','Assign a follow-up survey in the Tideglass project.'),('One successful week is enough to approve every site.','strikeout','Rejected shortcut: review paired observations and exceptions.')]),
 dict(heading='Evidence travels with the decision',paragraphs=[['The workbook contains paired site values, repeated transect measurements,','and summary formulas. The source-note table feeds a separate live chart.'],['Follow the supports relationship into its Evidence dialog. The saved quote','remains attached even when the source note or annotation is revised.']],bars=[('Data completeness',96),('Nursery readiness',89),('Review coverage',83)],anchors=[('Keep the original quote when an interpretation changes.','highlight','Capture a new version only after reviewing the underlying source.')])
])
create('lantern-readiness','Lantern network readiness','Ocean instruments / Deployment gate / Engineering review',[
 dict(heading='From bench to coastal water',paragraphs=[['Twelve sensor stations connect field observations to a shared planning map.','The engineering team is balancing uptime, calibration and recoverability.'],['The launch decision combines a telemetry workbook, a readiness task board,','and field protocols. Everything in this packet is fictional demo content.']],metrics=[('12','Planned stations'),('98.4%','Illustrative uptime'),('3 gates','Before deployment')],anchors=[('Deploy only after calibration, power and recovery checks.','highlight','The launch checklist maps these three gates to separate tasks.'),('A spare recovery beacon is required for offshore stations.','underline','Links the power design to the retrieval protocol.')]),
 dict(heading='A release gate is a shared record',paragraphs=[['Board columns represent the same task statuses used by Calendar and Projects.','Moving a launch card must update the task, not create another disconnected list.']],table=(['Gate','Owner role','Acceptance'],[['Calibration','Instrument lead','Reference drift checked'],['Power','Systems lead','Battery reserve verified'],['Recovery','Field lead','Beacon and retrieval plan'],['Data quality','Research lead','Missing intervals reviewed']]),anchors=[('Station L-07 remains blocked pending the spare connector.','comment','See the Supply chain note and the Lantern task board.'),('Missing telemetry can be filled with invented observations.','strikeout','Rejected: retain gaps and investigate the sensor.')],ink=True),
 dict(heading='Make uncertainty visible',paragraphs=[['The live readiness query is powered by frontmatter on station notes.','Changing a station status updates Canvas and its query-sourced chart.'],['The telemetry workbook is a separate, explicitly labeled measurement snapshot.','It contains daily uptime, packet count and battery-reserve series.']],bars=[('Bench verification',100),('Deployment readiness',83),('Recovery rehearsal',92)],anchors=[('A green dashboard is a prompt to inspect evidence, not a guarantee.','highlight','Review source provenance before accepting the deployment claim.')])
])
create('expedition-plan','The next tide','Pelagic Labs / Expedition portfolio / Budget and review',[
 dict(heading='One organization, six connected projects',paragraphs=[['Tideglass restores nursery plots. Lantern instruments the coastline.','Atlas makes the evidence retrievable. Harbor keeps operations moving.'],['Community workshops and expedition logistics share the same calendar,','project notes, task records and evidence review process.']],metrics=[('$180k','Planned allocation'),('6','Project workstreams'),('One vault','A shared source trail')],table=(['Workstream','Plan','Purpose'],[['Tideglass','$48,000','Nursery and surveys'],['Lantern','$36,000','Instruments and recovery'],['Atlas','$28,000','Data and evidence'],['Harbor','$24,000','Field logistics'],['Community','$18,000','Workshops and access'],['Stewardship','$26,000','Review and safeguards']]),anchors=[('The portfolio allocation totals 180000 dollars.','highlight','Compare with the Budget worksheet SUM formula.')]),
 dict(heading='Track variance before committing spend',paragraphs=[['Budget figures are synthetic planning values rather than market forecasts.','The workbook separates planned, committed and remaining amounts.'],['A second market-style sheet demonstrates candlestick and OHLC charts.','Its values are a fictional equipment-price index, never a real investment.']],bars=[('Review notes linked',100),('Supplier readiness',78),('Workshop planning',86)],anchors=[('Reallocate only after the project owner reviews the variance.','comment','Connect the decision to the budget chart and owner task.'),('The price index is fictional and is not a trading signal.','underline','Use this sheet to learn financial chart controls only.')],ink=True)
])
(OUT/'sources.json').write_text(json.dumps(sources,indent=2)+'\n')
print(f'Created {len(sources)} PDFs and source anchors in {OUT}')
